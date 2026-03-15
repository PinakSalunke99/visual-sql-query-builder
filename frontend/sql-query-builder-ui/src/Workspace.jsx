// src/Workspace.jsx

import React from 'react';
import { useDroppable } from '@dnd-kit/core';

// Helper function to generate prefixed columns for dropdowns
function getPrefixedColumns(allTables) {
  let columns = [];
  const tableNames = Object.keys(allTables);
  if (tableNames.length <= 1) {
    const tableName = tableNames[0];
    columns = tableName ? allTables[tableName] || [] : [];
  } else {
    tableNames.forEach(tableName => {
      (allTables[tableName] || []).forEach(col => {
        columns.push(`${tableName}.${col}`);
      });
    });
  }
  return columns;
}

// Single Rule component within the WHERE block
function WhereRule({ rule, ruleIndex, availableColumns, onChange, onRemove }) {
  const handleRuleChange = (key, value) => {
    onChange(ruleIndex, { ...rule, [key]: value });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', marginLeft: '10px' }}>
      <select onChange={(e) => handleRuleChange('column', e.target.value)} value={rule.column || ''} disabled={!availableColumns.length}>
        <option value="">Select column...</option>
        {availableColumns.map(col => (<option key={col} value={col}>{col}</option>))}
      </select>
      <select onChange={(e) => handleRuleChange('operator', e.target.value)} value={rule.operator || '='}>
        <option value="=">=</option>
        <option value=">">&gt;</option>
        <option value="<">&lt;</option>
        <option value="!=">!=</option>
      </select>
      <input type="text" placeholder="Value" value={rule.value || ''} onChange={(e) => handleRuleChange('value', e.target.value)} style={{ width: '100px', padding: '4px' }} />
      <button onClick={() => onRemove(ruleIndex)} style={{ background: '#ffaaaa', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', lineHeight: '18px', color: '#a11' }}>
        -
      </button>
    </div>
  );
}

// QueryBlock component
function QueryBlock({ block, schema, allTables, updateBlockData, onDelete }) {
  const availableColumns = getPrefixedColumns(allTables);
  const firstTableName = Object.keys(allTables)[0];
  const firstTableColumns = firstTableName ? allTables[firstTableName] : [];
  const secondTableName = Object.keys(allTables)[1];
  const secondTableColumns = secondTableName ? allTables[secondTableName] : [];
  const aggAvailableColumns = ['*', ...availableColumns];

  const handleDataChange = (key, value) => {
    updateBlockData(block.id, { ...block.data, [key]: value });
  };

  const handleInsertValueChange = (column, value) => {
    const newValues = { ...(block.data.values || {}), [column]: value };
    updateBlockData(block.id, { ...block.data, values: newValues });
  };

  // --- Handlers for CREATE TABLE ---
  const handleAddCreateColumn = () => {
    const currentCols = block.data.columns || [];
    const newCols = [...currentCols, { name: '', type: 'TEXT', pk: false }];
    handleDataChange('columns', newCols);
  };

  const handleCreateColumnUpdate = (idx, key, val) => {
    const newCols = block.data.columns.map((col, i) => i === idx ? { ...col, [key]: val } : col);
    handleDataChange('columns', newCols);
  };

  const handleRemoveCreateColumn = (idx) => {
    const newCols = block.data.columns.filter((_, i) => i !== idx);
    handleDataChange('columns', newCols);
  };

  // --- Handlers specific to the complex WHERE block ---
  const handleWhereRuleChange = (ruleIndex, updatedRule) => {
    const newRules = [...(block.data.rules || [])];
    newRules[ruleIndex] = updatedRule;
    updateBlockData(block.id, { ...block.data, rules: newRules });
  };

  const handleAddWhereRule = () => {
    const newRules = [...(block.data.rules || []), { column: '', operator: '=', value: '' }];
    updateBlockData(block.id, { ...block.data, rules: newRules });
  };

  const handleRemoveWhereRule = (ruleIndex) => {
    const newRules = (block.data.rules || []).filter((_, index) => index !== ruleIndex);
    updateBlockData(block.id, { ...block.data, rules: newRules });
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case 'create':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
            <div>
              <strong>CREATE TABLE:</strong>{' '}
              <input 
                type="text" 
                placeholder="Table Name" 
                value={block.data.table_name || ''} 
                onChange={(e) => handleDataChange('table_name', e.target.value)} 
                style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} 
              />
            </div>
            <div style={{ paddingLeft: '15px', borderLeft: '3px solid #1e88e5', background: 'rgba(255,255,255,0.5)', padding: '10px', borderRadius: '4px' }}>
              <div style={{ marginBottom: '5px' }}><strong>Columns:</strong></div>
              {(block.data.columns || []).map((col, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder="Name" 
                    value={col.name} 
                    onChange={(e) => handleCreateColumnUpdate(idx, 'name', e.target.value)} 
                    style={{width: '100px', padding: '2px'}} 
                  />
                  <select value={col.type} onChange={(e) => handleCreateColumnUpdate(idx, 'type', e.target.value)}>
                    <option value="INTEGER">INTEGER</option>
                    <option value="TEXT">TEXT</option>
                    <option value="REAL">REAL</option>
                  </select>
                  <label style={{fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px'}}>
                    <input type="checkbox" checked={col.pk} onChange={(e) => handleCreateColumnUpdate(idx, 'pk', e.target.checked)} /> 
                    PK
                  </label>
                  <button 
                    onClick={() => handleRemoveCreateColumn(idx)} 
                    style={{ background: '#ffaaaa', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '10px', color: '#a11' }}
                  >✕</button>
                </div>
              ))}
              <button 
                onClick={handleAddCreateColumn} 
                style={{ marginTop: '5px', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', backgroundColor: '#e1f5fe', border: '1px solid #03a9f4', borderRadius: '4px' }}
              >
                + Add Column
              </button>
            </div>
          </div>
        );
      case 'from':
        return (
          <>
            FROM{' '}
            <select onChange={(e) => handleDataChange('table', e.target.value)} value={block.data.table || ''}>
              <option value="">Select table...</option>
              {Object.keys(schema).map(table => (<option key={table} value={table}>{table}</option>))}
            </select>
          </>
        );
      case 'join':
        return (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
            <div>
              <select onChange={(e) => handleDataChange('type', e.target.value)} value={block.data.type || 'INNER'} style={{ marginRight: '5px' }}>
                <option value="INNER">INNER JOIN</option>
                <option value="LEFT">LEFT JOIN</option>
              </select>
              <select onChange={(e) => handleDataChange('table', e.target.value)} value={block.data.table || ''}>
                <option value="">Select table...</option>
                {Object.keys(schema).map(table => (table !== firstTableName && <option key={table} value={table}>{table}</option>))}
              </select>
            </div>
            {block.data.table && (
              <div style={{ paddingLeft: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ON{' '}
                <select onChange={(e) => handleDataChange('on_col1', e.target.value)} value={block.data.on_col1 || ''} disabled={!firstTableColumns.length}>
                  <option value="">{firstTableName || 'Table1'} Column...</option>
                  {firstTableColumns.map(col => (<option key={col} value={col}>{col}</option>))}
                </select>
                {' = '}
                 <select onChange={(e) => handleDataChange('on_col2', e.target.value)} value={block.data.on_col2 || ''} disabled={!secondTableColumns.length}>
                  <option value="">{secondTableName || 'Table2'} Column...</option>
                  {secondTableColumns.map(col => (<option key={col} value={col}>{col}</option>))}
                </select>
              </div>
            )}
           </div>
        );
      case 'select':
        return (
          <>
            SELECT{' '}
            <select multiple onChange={(e) => handleDataChange('columns', Array.from(e.target.selectedOptions, option => option.value))} value={block.data.columns || []} disabled={!availableColumns.length} style={{minWidth: '180px', height: '100px'}}>
              {availableColumns.map(col => (<option key={col} value={col}>{col}</option>))}
            </select>
            <small> (Ctrl/Cmd + click for multiple)</small>
          </>
        );
      case 'where':
        const rules = block.data.rules || [];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
            <div>
              WHERE join by{' '}
              <select onChange={(e) => handleDataChange('logical_operator', e.target.value)} value={block.data.logical_operator || 'AND'}>
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            </div>
            {rules.map((rule, index) => (
              <WhereRule key={index} rule={rule} ruleIndex={index} availableColumns={availableColumns} onChange={handleWhereRuleChange} onRemove={handleRemoveWhereRule} />
            ))}
            <button onClick={handleAddWhereRule} style={{ marginLeft: '10px', background: '#aaddaa', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', color: '#151' }}>
              + Add Condition
            </button>
          </div>
        );
      case 'orderby':
        return (
          <>
            ORDER BY{' '}
            <select onChange={(e) => handleDataChange('column', e.target.value)} value={block.data.column || ''} disabled={!availableColumns.length}>
              <option value="">Select column...</option>
              {availableColumns.map(col => (<option key={col} value={col}>{col}</option>))}
            </select>
            {' '}
            <select onChange={(e) => handleDataChange('direction', e.target.value)} value={block.data.direction || 'ASC'}>
              <option value="ASC">ASC (Ascending)</option>
              <option value="DESC">DESC (Descending)</option>
            </select>
          </>
        );
      case 'groupby':
        return (
          <>
            GROUP BY{' '}
            <select onChange={(e) => handleDataChange('column', e.target.value)} value={block.data.column || ''} disabled={!availableColumns.length}>
              <option value="">Select column...</option>
              {availableColumns.map(col => (<option key={col} value={col}>{col}</option>))}
            </select>
          </>
        );
      case 'count':
      case 'avg':
      case 'sum':
        return (
          <>
            {block.type.toUpperCase()}{' '}
            <select onChange={(e) => handleDataChange('column', e.target.value)} value={block.data.column || '*'} disabled={!aggAvailableColumns.length}>
              {aggAvailableColumns.map(col => (<option key={col} value={col}>{col}</option>))}
            </select>
          </>
        );
      case 'insert':
        const selectedTable = block.data.table;
        const tableColumns = selectedTable ? schema[selectedTable] || [] : [];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
            <div>
              INSERT INTO{' '}
              <select onChange={(e) => handleDataChange('table', e.target.value)} value={selectedTable || ''}>
                <option value="">Select table...</option>
                {Object.keys(schema).map(table => (<option key={table} value={table}>{table}</option>))}
              </select>
            </div>
            {selectedTable && (
              <div style={{ paddingLeft: '20px', borderLeft: '2px solid #90caf9', marginTop: '10px' }}>
                <strong>VALUES:</strong>
                {tableColumns.map(column => (
                  <div key={column} style={{ marginTop: '5px', display: 'flex', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px', width: '120px', textAlign: 'right' }}>{column}:</label>
                    <input type="text" placeholder={column} onChange={(e) => handleInsertValueChange(column, e.target.value)} style={{ padding: '4px' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'delete':
        const deleteTable = block.data.table;
        const deleteCols = deleteTable ? schema[deleteTable] || [] : [];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
            <div>
              DELETE FROM{' '}
              <select onChange={(e) => handleDataChange('table', e.target.value)} value={deleteTable || ''}>
                <option value="">Select table...</option>
                {Object.keys(schema).map(table => (<option key={table} value={table}>{table}</option>))}
              </select>
            </div>
            <div style={{ paddingLeft: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              WHERE{' '}
              <select onChange={(e) => handleDataChange('column', e.target.value)} value={block.data.column || ''} disabled={!deleteCols.length}>
                <option value="">Select column...</option>
                {deleteCols.map(col => (<option key={col} value={col}>{col}</option>))}
              </select>
              {' '}
              <select onChange={(e) => handleDataChange('operator', e.target.value)} value={block.data.operator || '='}>
                <option value="=">=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value="!=">!=</option>
              </select>
              {' '}
              <input type="text" placeholder="Value" value={block.data.value || ''} onChange={(e) => handleDataChange('value', e.target.value)} style={{ width: '100px', padding: '4px' }} />
            </div>
          </div>
        );
      case 'update':
        const updateTable = block.data.table;
        const updateCols = updateTable ? schema[updateTable] || [] : [];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'flex-start' }}>
            <div>
              UPDATE{' '}
              <select onChange={(e) => handleDataChange('table', e.target.value)} value={updateTable || ''}>
                <option value="">Select table...</option>
                {Object.keys(schema).map(table => ( <option key={table} value={table}>{table}</option> ))}
              </select>
            </div>
            <div style={{ paddingLeft: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              SET{' '}
              <select onChange={(e) => handleDataChange('set_column', e.target.value)} value={block.data.set_column || ''} disabled={!updateCols.length}>
                <option value="">Select column...</option>
                {updateCols.map(col => (<option key={col} value={col}>{col}</option>))}
              </select>
              {' = '}
              <input type="text" placeholder="New Value" value={block.data.set_value || ''} onChange={(e) => handleDataChange('set_value', e.target.value)} style={{ width: '100px', padding: '4px' }} />
            </div>
            <div style={{ paddingLeft: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              WHERE{' '}
              <select onChange={(e) => handleDataChange('where_column', e.target.value)} value={block.data.where_column || ''} disabled={!updateCols.length}>
                <option value="">Select column...</option>
                {updateCols.map(col => (<option key={col} value={col}>{col}</option>))}
              </select>
              <select onChange={(e) => handleDataChange('where_operator', e.target.value)} value={block.data.where_operator || '='}>
                <option value="=">=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value="!=">!=</option>
              </select>
              <input type="text" placeholder="Value" value={block.data.where_value || ''} onChange={(e) => handleDataChange('where_value', e.target.value)} style={{ width: '100px', padding: '4px' }} />
            </div>
          </div>
        );
      default:
        return block.type.toUpperCase();
    }
  };

  const blockStyle = {
    background: '#e3f2fd', border: '1px solid #90caf9', color: '#1e88e5', padding: '10px 15px', margin: '8px 0', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', paddingRight: '40px',
  };
  const deleteButtonStyle = {
    position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', background: 'none', color: '#90caf9', border: '1px solid transparent', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', lineHeight: '22px', textAlign: 'center', fontWeight: 'normal', fontFamily: 'sans-serif', transition: 'all 0.2s ease',
  };
  const deleteButtonHoverStyle = {
    color: '#1e88e5', borderColor: '#1e88e5', backgroundColor: '#e0f2f7',
  };

  return (
    <div style={blockStyle}>
      <div style={{ flexGrow: 1 }}>{renderBlockContent()}</div>
      <button
        style={deleteButtonStyle}
        onMouseEnter={e => {
          e.currentTarget.style.color = deleteButtonHoverStyle.color;
          e.currentTarget.style.borderColor = deleteButtonHoverStyle.borderColor;
          e.currentTarget.style.backgroundColor = deleteButtonHoverStyle.backgroundColor;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = deleteButtonStyle.color;
          e.currentTarget.style.borderColor = deleteButtonStyle.borderColor;
          e.currentTarget.style.backgroundColor = deleteButtonStyle.background;
        }}
        onClick={() => onDelete(block.id)}
        aria-label="Delete block"
      >
        &#x2715;
      </button>
    </div>
  );
}

// --- MAIN WORKSPACE COMPONENT ---
function Workspace({ blocks, allTables, schema, updateBlockData, onGenerateSql, handleDeleteBlock, onClearWorkspace }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'workspace' });

  const buttonStyle = { border: 'none', padding: '10px 20px', fontSize: '16px', borderRadius: '4px', cursor: 'pointer' };
  const runButtonStyle = { ...buttonStyle, background: '#1976d2', color: 'white' };
  const clearButtonStyle = { ...buttonStyle, background: '#6c757d', color: 'white' };

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 3, minWidth: 0, padding: '1rem', backgroundColor: isOver ? '#e8f0fe' : '#fafafa', transition: 'background-color 0.2s ease', borderLeft: '2px solid #ccc', overflowY: 'auto', display: 'flex', flexDirection: 'column'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
        <h2>Workspace</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClearWorkspace} style={clearButtonStyle}>Clear Workspace</button>
          <button onClick={onGenerateSql} style={runButtonStyle}>▶️ Run Query</button>
        </div>
      </div>

      <div style={{ border: '2px dashed #ccc', padding: '1rem', borderRadius: '4px', flexGrow: 1, overflowY: 'auto', minHeight: '200px' }}>
        {blocks.length === 0 ? (
          <p>Drop your query blocks here.</p>
        ) : (
          blocks.map(block => (
            <QueryBlock
              key={block.id}
              block={block}
              schema={schema}
              allTables={allTables}
              updateBlockData={updateBlockData}
              onDelete={handleDeleteBlock}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default Workspace;
