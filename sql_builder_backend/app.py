# app.py

import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- App Setup ---
app = Flask(__name__)
CORS(app)
DATABASE = 'database.db'

# --- Recursive Helper Function to Build WHERE Clause ---
# This function now correctly handles prefixes based on passed aliases
def _build_nested_where(condition_group, table_aliases, primary_table_name):
    if not condition_group or not condition_group.get('rules'):
        return ""

    clauses = []
    # Determine the default alias (usually 't1' for SELECT, none otherwise)
    # If table_aliases is empty, primary_alias will be None.
    primary_alias = next((alias for alias, table in table_aliases.items() if table == primary_table_name), None)
    # If still None but aliases exist (e.g., SELECT default), use t1 as fallback
    if primary_alias is None and 't1' in table_aliases:
        primary_alias = 't1'


    for rule in condition_group['rules']:
        if 'logical_operator' in rule: # Nested group
            nested_clause = _build_nested_where(rule, table_aliases, primary_table_name)
            if nested_clause:
                clauses.append(f"({nested_clause})")
        elif 'column' in rule: # Simple rule
            col_name_full = rule['column']
            col_name_part = col_name_full
            prefix_alias = primary_alias # Start with default
            prefix = f"`{prefix_alias}`." if prefix_alias else "" # Only add prefix if alias exists

            if '.' in col_name_full: # If frontend sent prefix
                parts = col_name_full.split('.')
                table_part = parts[0]
                col_name_part = parts[1]
                found_alias = next((alias for alias, table in table_aliases.items() if table_part == table), None)
                if found_alias:
                    prefix_alias = found_alias
                    prefix = f"`{prefix_alias}`."
                else: # Table name from frontend not in our aliases? Risky, use no prefix.
                    prefix = ""
            # If no prefix identified YET and we *should* have one (primary_alias exists), apply it.
            elif prefix_alias and prefix == "":
                 prefix = f"`{prefix_alias}`."

            column = f"{prefix}`{col_name_part}`"
            operator = rule.get('operator', '=')
            value = rule.get('value')

            if value is None or value == '': continue

            if isinstance(value, str):
                value_str = f"'{value}'" if not value.isnumeric() else f"{value}"
            else:
                 value_str = str(value)

            clauses.append(f"{column} {operator} {value_str}")

    logical_operator = f" {condition_group.get('logical_operator', 'AND')} "
    return logical_operator.join(clauses)


# --- (get_schema endpoint remains unchanged) ---
@app.route('/api/schema', methods=['GET'])
def get_schema():
    # ... (same as before) ...
    conn = None
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        schema = {}
        for table in tables:
            if table.startswith('sqlite_'): continue
            cursor.execute(f"PRAGMA table_info(`{table}`);")
            columns = [row[1] for row in cursor.fetchall()]
            schema[table] = columns
        return jsonify(schema)
    except sqlite3.Error as e:
        return jsonify({"status": "error", "error_message": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- Main API Endpoint ---
@app.route('/api/generate-sql', methods=['POST'])
def generate_sql():
    req_data = request.get_json()
    if not req_data:
        return jsonify({"error": "No data provided"}), 400

    query_type = req_data.get('query_type')
    table_name = req_data.get('table_name')
    sql_query = ""

    if query_type == 'SELECT':
        # ... (SELECT logic remains the same as the last correct version) ...
        # ... (It correctly uses table_aliases for JOINs etc.) ...
        if not table_name: return jsonify({"error": "SELECT query must have a FROM table"}), 400
        table_aliases = {'t1': table_name}
        from_clause = f"`{table_name}` AS t1"
        join_clause = ""
        join_data = req_data.get('join')
        if join_data and join_data.get('table') and join_data.get('on_col1') and join_data.get('on_col2'):
            join_table = join_data['table']; table_aliases['t2'] = join_table
            join_type = join_data.get('type', 'INNER').upper(); join_type = 'INNER' if join_type not in ['INNER', 'LEFT', 'RIGHT', 'FULL OUTER'] else join_type
            on_col1 = join_data['on_col1']; on_col2 = join_data['on_col2']
            join_clause = f"{join_type} JOIN `{join_table}` AS t2 ON `t1`.`{on_col1}` = `t2`.`{on_col2}`"
        columns = req_data.get('columns', [])
        select_parts = []
        if not columns and not req_data.get('aggregates'): select_parts = ['`t1`.*', '`t2`.*'] if 't2' in table_aliases else ['`t1`.*']
        else:
            for col in columns:
                if '.' in col:
                    parts = col.split('.'); table_part = parts[0]; col_part = parts[1]
                    found_alias = next((alias for alias, table in table_aliases.items() if table_part == table), None)
                    if found_alias: select_parts.append(f"`{found_alias}`.`{col_part}`")
                    else: select_parts.append(f"`{col_part}`")
                else: select_parts.append(f"`t1`.`{col}`")
        aggregates = req_data.get('aggregates', [])
        for agg in aggregates:
             if agg.get('function') and agg.get('column'):
                col_name_full = agg['column']; col_name_part = col_name_full
                primary_alias = next((alias for alias, table in table_aliases.items() if table == table_name), 't1')
                prefix = f"`{primary_alias}`." if primary_alias else ""
                if '.' in col_name_full:
                    parts = col_name_full.split('.'); table_part = parts[0]; col_name_part = parts[1]
                    found_alias = next((alias for alias, table in table_aliases.items() if table_part == table), None)
                    if found_alias: prefix = f"`{found_alias}`."
                    else: prefix = ''
                elif col_name_full == '*': prefix = ''; col_name_part = '*'
                col = f"{prefix}`{col_name_part}`" if col_name_part != '*' else '*'
                alias_name = agg.get('alias', f'{agg["function"]}_{col_name_full.replace(".","_")}')
                alias = f" AS `{alias_name}`"
                select_parts.append(f"{agg['function'].upper()}({col}){alias}")
        columns_str = ', '.join(select_parts) if select_parts else '*'
        where_clause_str = _build_nested_where(req_data.get('conditions'), table_aliases, table_name)
        where_clause = f"WHERE {where_clause_str}" if where_clause_str else ""
        groupby_clause = ""
        groupby_col_full = req_data.get('groupby')
        if groupby_col_full:
            groupby_col_part = groupby_col_full
            primary_alias = next((alias for alias, table in table_aliases.items() if table == table_name), 't1')
            prefix = f"`{primary_alias}`." if primary_alias else ""
            if '.' in groupby_col_full:
                 parts = groupby_col_full.split('.'); table_part = parts[0]; groupby_col_part = parts[1]
                 found_alias = next((alias for alias, table in table_aliases.items() if table_part == table), None)
                 if found_alias: prefix = f"`{found_alias}`."
                 else: prefix = ''
            groupby_clause = f"GROUP BY {prefix}`{groupby_col_part}`"
        orderby_clause = ""
        orderby_data = req_data.get('orderby')
        if orderby_data and orderby_data.get('column') and orderby_data.get('direction'):
            col_name_full = orderby_data['column']; col_name_part = col_name_full
            primary_alias = next((alias for alias, table in table_aliases.items() if table == table_name), 't1')
            prefix = f"`{primary_alias}`." if primary_alias else ""
            if '.' in col_name_full:
                parts = col_name_full.split('.'); table_part = parts[0]; col_name_part = parts[1]
                found_alias = next((alias for alias, table in table_aliases.items() if table_part == table), None)
                if found_alias: prefix = f"`{found_alias}`."
                else: prefix = ''
            col = f"{prefix}`{col_name_part}`"
            dir = orderby_data['direction'].upper()
            if dir in ['ASC', 'DESC']: orderby_clause = f"ORDER BY {col} {dir}"
        sql_query = f"SELECT {columns_str} FROM {from_clause} {join_clause} {where_clause} {groupby_clause} {orderby_clause};"


    # --- CORRECTED UPDATE ---
    elif query_type == 'UPDATE':
        assignments = req_data.get('assignments', {})
        set_clauses = ', '.join([f"`{k}` = '{v}'" if isinstance(v, str) else f"`{k}` = {v}" for k, v in assignments.items()])
        # Call WHERE builder with EMPTY table_aliases for UPDATE
        where_clause_str = _build_nested_where(req_data.get('conditions'), {}, table_name) # Pass {}
        where_clause = f"WHERE {where_clause_str}" if where_clause_str else ""
        if not where_clause: return jsonify({"error": "UPDATE statements must have a WHERE clause"}), 400
        sql_query = f"UPDATE `{table_name}` SET {set_clauses} {where_clause};" # Use raw table name

    # --- CORRECTED DELETE ---
    elif query_type == 'DELETE':
        # Call WHERE builder with EMPTY table_aliases for DELETE
        where_clause_str = _build_nested_where(req_data.get('conditions'), {}, table_name) # Pass {}
        where_clause = f"WHERE {where_clause_str}" if where_clause_str else ""
        if not where_clause: return jsonify({"error": "DELETE statements must have a WHERE clause"}), 400
        sql_query = f"DELETE FROM `{table_name}` {where_clause};" # Use raw table name

    # --- (INSERT remains unchanged) ---
    elif query_type == 'INSERT':
        values = req_data.get('values', {})
        columns = ', '.join([f"`{k}`" for k in values.keys()])
        vals = ', '.join([f"'{v}'" if isinstance(v, str) else str(v) for v in values.values()])
        sql_query = f"INSERT INTO `{table_name}` ({columns}) VALUES ({vals});"

    else:
        return jsonify({"error": f"Unsupported query type: {query_type}"}), 400

    conn = None
    try:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        print(f"Executing SQL: {sql_query}")
        cursor.execute(sql_query)

        if query_type == 'SELECT':
            columns = [description[0] for description in cursor.description]
            results = [dict(row) for row in cursor.fetchall()]
            response_data = {"query_results": results}
        else:
            conn.commit()
            response_data = {"message": "Operation successful.", "rows_affected": cursor.rowcount}

        return jsonify({
            "status": "success",
            "generated_sql": sql_query.strip(),
            "data": response_data
        })
    except sqlite3.Error as e:
        error_msg = f"Database error: {str(e)} (SQL: {sql_query.strip()})"
        print(f"ERROR: {error_msg}")
        return jsonify({"status": "error", "error_message": error_msg, "generated_sql": sql_query.strip()}), 400
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    app.run(debug=True)