# app.py

import sqlite3
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- App Setup ---
app = Flask(__name__)
CORS(app)
DATABASE = 'database.db'

# --- Recursive Helper Function to Build WHERE Clause ---
# This is the robust version that handles SELECT (with t1/t2 aliases)
# as well as UPDATE/DELETE (where no aliases are used).
def _build_nested_where(condition_group, table_aliases, primary_table_name):
    if not condition_group or not condition_group.get('rules'):
        return ""

    clauses = []
    # Determine the default alias (usually 't1' for SELECT, None otherwise)
    primary_alias = next((alias for alias, table in table_aliases.items() if table == primary_table_name), None)
    
    # If still None but aliases exist (e.g., SELECT default), use t1 as fallback
    if primary_alias is None and 't1' in table_aliases:
        primary_alias = 't1'

    for rule in condition_group['rules']:
        if 'logical_operator' in rule: # It's a nested group (e.g., from multiple WHERE blocks)
            nested_clause = _build_nested_where(rule, table_aliases, primary_table_name)
            if nested_clause:
                clauses.append(f"({nested_clause})") # Add parentheses around nested groups
        elif 'column' in rule: # It's a simple rule
            col_name_full = rule['column']
            col_name_part = col_name_full
            prefix_alias = primary_alias
            prefix = f"`{prefix_alias}`." if prefix_alias else ""

            if '.' in col_name_full: # Handle 'TableName.Column' format from frontend
                parts = col_name_full.split('.')
                table_part = parts[0]
                col_name_part = parts[1]
                found_alias = next((alias for alias, table in table_aliases.items() if table_part == table), None)
                if found_alias:
                    prefix_alias = found_alias
                    prefix = f"`{prefix_alias}`."
                else:
                    prefix = ""
            elif prefix_alias and prefix == "": # Apply default prefix if needed
                 prefix = f"`{prefix_alias}`."

            column = f"{prefix}`{col_name_part}`"
            operator = rule.get('operator', '=')
            value = rule.get('value')

            # Basic validation: skip if value is missing
            if value is None or value == '': continue

            if isinstance(value, str):
                if value.isnumeric():
                    value_str = f"{value}"
                else:
                    value_str = f"'{value}'"
            else: # Handle numbers directly
                 value_str = str(value)

            clauses.append(f"{column} {operator} {value_str}")

    logical_operator = f" {condition_group.get('logical_operator', 'AND')} "
    return logical_operator.join(clauses)


# --- Endpoint to fetch Database Schema ---
@app.route('/api/schema', methods=['GET'])
def get_schema():
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

# --- Main API Endpoint for Query Generation and Execution ---
@app.route('/api/generate-sql', methods=['POST'])
def generate_sql():
    req_data = request.get_json()
    if not req_data:
        return jsonify({"error": "No data provided"}), 400

    query_type = req_data.get('query_type')
    table_name = req_data.get('table_name')
    sql_query = ""

    # --- 1. CREATE TABLE LOGIC ---
    if query_type == 'CREATE':
        if not table_name:
            return jsonify({"error": "Table name required"}), 400
        cols_data = req_data.get('columns', [])
        if not cols_data:
            return jsonify({"error": "At least one column is required"}), 400
        
        col_defs = []
        for col in cols_data:
            name = col.get('name')
            dtype = col.get('type', 'TEXT')
            is_pk = col.get('pk', False)
            if not name: continue
            pk_str = " PRIMARY KEY" if is_pk else ""
            col_defs.append(f"`{name}` {dtype}{pk_str}")
        
        sql_query = f"CREATE TABLE `{table_name}` ({', '.join(col_defs)});"

    # --- 2. SELECT LOGIC (Supports JOIN, Aggregates, GroupBy, OrderBy) ---
    elif query_type == 'SELECT':
        if not table_name:
            return jsonify({"error": "SELECT query must have a FROM table"}), 400

        table_aliases = {'t1': table_name}
        from_clause = f"`{table_name}` AS t1"
        join_clause = ""
        join_data = req_data.get('join')

        if join_data and join_data.get('table') and join_data.get('on_col1') and join_data.get('on_col2'):
            join_table = join_data['table']
            table_aliases['t2'] = join_table
            join_type = join_data.get('type', 'INNER').upper()
            if join_type not in ['INNER', 'LEFT']: join_type = 'INNER'
            on_col1 = join_data['on_col1']
            on_col2 = join_data['on_col2']
            join_clause = f"{join_type} JOIN `{join_table}` AS t2 ON `t1`.`{on_col1}` = `t2`.`{on_col2}`"

        columns = req_data.get('columns', [])
        select_parts = []
        if not columns and not req_data.get('aggregates'):
            select_parts = ['`t1`.*', '`t2`.*'] if 't2' in table_aliases else ['`t1`.*']
        else:
            # Build column parts with aliases
            for col in columns:
                if '.' in col:
                    parts = col.split('.')
                    table_part = parts[0]
                    col_part = parts[1]
                    found_alias = next((alias for alias, table in table_aliases.items() if table_part == table), None)
                    if found_alias: select_parts.append(f"`{found_alias}`.`{col_part}`")
                    else: select_parts.append(f"`{col_part}`")
                else:
                    select_parts.append(f"`t1`.`{col}`")

        # Handle Aggregates (COUNT, AVG, SUM)
        aggregates = req_data.get('aggregates', [])
        for agg in aggregates:
             if agg.get('function') and agg.get('column'):
                col_name_full = agg['column']
                col_name_part = col_name_full
                primary_alias = next((alias for alias, table in table_aliases.items() if table == table_name), 't1')
                prefix = f"`{primary_alias}`." if primary_alias else ""
                
                if '.' in col_name_full:
                    parts = col_name_full.split('.')
                    table_part = parts[0]
                    col_name_part = parts[1]
                    found_alias = next((alias for alias, table in table_aliases.items() if table_part == table), None)
                    if found_alias: prefix = f"`{found_alias}`."
                    else: prefix = ''
                elif col_name_full == '*':
                    prefix = ''
                    col_name_part = '*'
                
                col_ref = f"{prefix}`{col_name_part}`" if col_name_part != '*' else '*'
                alias_name = f'{agg["function"]}_{col_name_full.replace(".","_")}'
                select_parts.append(f"{agg['function'].upper()}({col_ref}) AS `{alias_name}`")

        columns_str = ', '.join(select_parts) if select_parts else '*'

        # Build WHERE clause
        where_clause_str = _build_nested_where(req_data.get('conditions'), table_aliases, table_name)
        where_clause = f"WHERE {where_clause_str}" if where_clause_str else ""

        # Build GROUP BY clause
        groupby_clause = ""
        groupby_col = req_data.get('groupby')
        if groupby_col:
            prefix = "`t1`."
            if '.' in groupby_col:
                parts = groupby_col.split('.')
                found_alias = next((alias for alias, table in table_aliases.items() if parts[0] == table), None)
                prefix = f"`{found_alias}`." if found_alias else ""
                groupby_col = parts[1]
            groupby_clause = f"GROUP BY {prefix}`{groupby_col}`"

        # Build ORDER BY clause
        orderby_clause = ""
        orderby_data = req_data.get('orderby')
        if orderby_data and orderby_data.get('column'):
            col_name = orderby_data['column']
            prefix = "`t1`."
            if '.' in col_name:
                parts = col_name.split('.')
                found_alias = next((alias for alias, table in table_aliases.items() if parts[0] == table), None)
                prefix = f"`{found_alias}`." if found_alias else ""
                col_name = parts[1]
            direction = orderby_data.get('direction', 'ASC').upper()
            orderby_clause = f"ORDER BY {prefix}`{col_name}` {direction}"

        sql_query = f"SELECT {columns_str} FROM {from_clause} {join_clause} {where_clause} {groupby_clause} {orderby_clause};"

    # --- 3. UPDATE LOGIC ---
    elif query_type == 'UPDATE':
        assignments = req_data.get('assignments', {})
        set_clauses = ', '.join([f"`{k}` = '{v}'" if isinstance(v, str) else f"`{k}` = {v}" for k, v in assignments.items()])
        where_clause_str = _build_nested_where(req_data.get('conditions'), {}, table_name)
        where_clause = f"WHERE {where_clause_str}" if where_clause_str else ""
        if not where_clause: return jsonify({"error": "UPDATE requires a WHERE clause"}), 400
        sql_query = f"UPDATE `{table_name}` SET {set_clauses} {where_clause};"

    # --- 4. DELETE LOGIC ---
    elif query_type == 'DELETE':
        where_clause_str = _build_nested_where(req_data.get('conditions'), {}, table_name)
        where_clause = f"WHERE {where_clause_str}" if where_clause_str else ""
        if not where_clause: return jsonify({"error": "DELETE requires a WHERE clause"}), 400
        sql_query = f"DELETE FROM `{table_name}` {where_clause};"

    # --- 5. INSERT LOGIC ---
    elif query_type == 'INSERT':
        values = req_data.get('values', {})
        columns = ', '.join([f"`{k}`" for k in values.keys()])
        vals = ', '.join([f"'{v}'" if isinstance(v, str) else str(v) for v in values.values()])
        sql_query = f"INSERT INTO `{table_name}` ({columns}) VALUES ({vals});"

    else:
        return jsonify({"error": f"Unsupported query type: {query_type}"}), 400

    # Execution Engine
    conn = None
    try:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        print(f"Executing SQL: {sql_query}")
        cursor.execute(sql_query)

        if query_type == 'SELECT':
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
        return jsonify({"status": "error", "error_message": str(e), "generated_sql": sql_query.strip()}), 400
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    # Production-ready port assignment
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
