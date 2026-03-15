// src/App.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DndContext } from '@dnd-kit/core';
import BlockPalette from './BlockPalette';
import Workspace from './Workspace';
import ResultsTable from './ResultsTable';

// Production Render URL
const API_BASE_URL = 'https://visual-sql-query-builder-1.onrender.com';

function App() {
  const [dbSchema, setDbSchema] = useState({});
  const [queryBlocks, setQueryBlocks] = useState([]);
  const [queryResults, setQueryResults] = useState(null);
  const [generatedSql, setGeneratedSql] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Initial schema fetch
  useEffect(() => {
    fetchSchema();
  }, []);

  const fetchSchema = () => {
    axios.get(`${API_BASE_URL}/api/schema`)
      .then(response => {
        setDbSchema(response.data);
      })
      .catch(error => {
        console.error("Error fetching schema:", error);
        setError("Could not connect to backend. Is the Flask server running?");
      });
  };

  // Drag and Drop Handler - Maintains precise initial state for every block type
  function handleDragEnd(event) {
    const { active, over } = event;
    if (over && over.id === 'workspace' && typeof active.id === 'string' && active.id.includes('-block')) {
      const type = active.id.split('-')[0];
      let initialData = {};

      if (type === 'create') {
        // Initial state for the new Schema Definition block
        initialData = { table_name: '', columns: [{ name: 'id', type: 'INTEGER', pk: true }] };
      }
      else if (type === 'where') {
        initialData = { logical_operator: 'AND', rules: [{ column: '', operator: '=', value: '' }] };
      }
      else if (type === 'delete') {
         initialData = { operator: '=' };
      }
      else if (type === 'update') {
        initialData = { where_operator: '=' };
      }
      else if (type === 'orderby') {
        initialData = { direction: 'ASC' };
      }
      else if (type === 'count' || type === 'avg' || type === 'sum') {
        initialData = { column: '*' };
      }
      else if (type === 'join') {
        initialData = { type: 'INNER' };
      }

      const newBlock = { id: Date.now(), type: type, data: initialData };
      setQueryBlocks(prev => [...prev, newBlock]);
    }
  }

  const updateBlockData = (id, data) => {
    setQueryBlocks(prev =>
      prev.map(block => (block.id === id ? { ...block, data } : block))
    );
  };

  const handleDeleteBlock = (idToDelete) => {
    setQueryBlocks(prevBlocks =>
      prevBlocks.filter(block => block.id !== idToDelete)
    );
  };

  const handleClearWorkspace = () => {
    setQueryBlocks([]);
    setQueryResults(null);
    setGeneratedSql('');
    setError('');
  };

  // The "Compiler" Core - Logic to transform Visual Blocks into JSON AST
  const handleGenerateSql = async () => {
    setError('');
    setQueryResults(null);
    setGeneratedSql('');
    setLoading(true);

    if (queryBlocks.length === 0) {
      setError("Workspace is empty.");
      setLoading(false);
      return;
    }

    // Determine query type through exhaustive block check
    const hasCreate = queryBlocks.some(b => b.type === 'create');
    const hasInsert = queryBlocks.some(b => b.type === 'insert');
    const hasDelete = queryBlocks.some(b => b.type === 'delete');
    const hasUpdate = queryBlocks.some(b => b.type === 'update');
    const hasFrom = queryBlocks.some(b => b.type === 'from');

    let commandJson = {};

    // 1. CREATE TABLE Logic
    if (hasCreate) {
        const createBlock = queryBlocks.find(b => b.type === 'create');
        if (!createBlock.data.table_name) {
          setError("CREATE block must have a table name.");
          setLoading(false);
          return;
        }
        commandJson = {
          query_type: "CREATE",
          table_name: createBlock.data.table_name,
          columns: createBlock.data.columns || []
        };
    }
    // 2. INSERT Logic
    else if (hasInsert) {
        const insertBlock = queryBlocks.find(b => b.type === 'insert');
        if (!insertBlock.data.table) { 
          setError("INSERT block must have a selected table."); 
          setLoading(false); 
          return; 
        }
        commandJson = { 
          query_type: "INSERT", 
          table_name: insertBlock.data.table, 
          values: insertBlock.data.values || {}, 
        };
    } 
    // 3. DELETE Logic
    else if (hasDelete) {
        const deleteBlock = queryBlocks.find(b => b.type === 'delete');
        const data = deleteBlock.data;
        if (!data.table || !data.column || !data.operator || data.value === undefined || data.value === null || data.value === '') { 
          setError("DELETE statements must be complete (table, column, operator, value)."); 
          setLoading(false); 
          return; 
        }
        commandJson = { 
          query_type: "DELETE", 
          table_name: data.table, 
          conditions: { 
            logical_operator: "AND", 
            rules: [{ column: data.column, operator: data.operator, value: data.value }] 
          } 
        };
    } 
    // 4. UPDATE Logic
    else if (hasUpdate) {
        const updateBlock = queryBlocks.find(b => b.type === 'update');
        const data = updateBlock.data;
        if (!data.table || !data.set_column || data.set_value === undefined || !data.where_column || !data.where_operator || data.where_value === undefined || data.where_value === null || data.where_value === '') { 
          setError("UPDATE statements must be complete (table, SET col/val, WHERE col/op/val)."); 
          setLoading(false); 
          return; 
        }
        commandJson = { 
          query_type: "UPDATE", 
          table_name: data.table, 
          assignments: { [data.set_column]: data.set_value }, 
          conditions: { 
            logical_operator: "AND", 
            rules: [{ column: data.where_column, operator: data.where_operator, value: data.where_value }] 
          } 
        };
    }
    // 5. SELECT / JOIN / AGGREGATE Logic
    else if (hasFrom) {
      const fromBlock = queryBlocks.find(b => b.type === 'from');
      const joinBlock = queryBlocks.find(b => b.type === 'join');
      const selectBlock = queryBlocks.find(b => b.type === 'select');
      const whereBlocks = queryBlocks.filter(b => b.type === 'where');
      const orderbyBlock = queryBlocks.find(b => b.type === 'orderby');
      const groupbyBlock = queryBlocks.find(b => b.type === 'groupby');
      const aggregateBlocks = queryBlocks.filter(b => b.type === 'count' || b.type === 'avg' || b.type === 'sum');

      commandJson = {
        query_type: "SELECT",
        table_name: fromBlock.data.table,
        columns: selectBlock ? selectBlock.data.columns || [] : [],
      };

      if (joinBlock && joinBlock.data.table && joinBlock.data.on_col1 && joinBlock.data.on_col2) {
        commandJson.join = { 
          type: joinBlock.data.type || 'INNER', 
          table: joinBlock.data.table, 
          on_col1: joinBlock.data.on_col1, 
          on_col2: joinBlock.data.on_col2 
        };
      }

      // Build nested conditions from ALL WHERE blocks (OR logic between blocks)
      if (whereBlocks.length > 0) {
        const whereGroups = whereBlocks.map(block => {
          if (block.data.rules && block.data.rules.length > 0) {
            const validRules = block.data.rules.filter( rule => rule.column && rule.operator && rule.value !== undefined && rule.value !== null && rule.value !== '' );
            if (validRules.length > 0) { 
              return { 
                logical_operator: block.data.logical_operator || 'AND', 
                rules: validRules 
              }; 
            }
          }
          return null;
        }).filter(Boolean);

        if (whereGroups.length === 1) { 
          commandJson.conditions = whereGroups[0]; 
        }
        else if (whereGroups.length > 1) { 
          commandJson.conditions = { logical_operator: "OR", rules: whereGroups }; 
        }
      }

      if (orderbyBlock && orderbyBlock.data.column) { 
        commandJson.orderby = { column: orderbyBlock.data.column, direction: orderbyBlock.data.direction || 'ASC' }; 
      }
      if (groupbyBlock && groupbyBlock.data.column) { 
        commandJson.groupby = groupbyBlock.data.column; 
      }
      if (aggregateBlocks.length > 0) { 
        commandJson.aggregates = aggregateBlocks.map(block => ({ function: block.type, column: block.data.column || '*' })); 
      }
    }
    else {
        setError(`Invalid query structure. Missing FROM block for SELECT or modification block.`);
        setLoading(false);
        return;
    }

    // API Call and State Updates
    try {
      console.log("Sending JSON AST to backend:", JSON.stringify(commandJson, null, 2));
      const response = await axios.post(`${API_BASE_URL}/api/generate-sql`, commandJson);
      
      if (response.data.status === 'success') {
        setQueryResults(response.data.data);
        setGeneratedSql(response.data.generated_sql);
        
        // Semantic Refinement: If we created a table, refresh the dropdown schema
        if (hasCreate) {
          fetchSchema();
        }
      } else {
        setError(response.data.error_message);
        setGeneratedSql(response.data.generated_sql || '');
      }
    } catch (err) {
      console.error("API call failed:", err);
      setError(err.response?.data?.error_message || "An unknown error occurred during API call.");
      if (err.response?.data?.generated_sql) {
        setGeneratedSql(err.response.data.generated_sql);
      }
    } finally {
      setLoading(false);
    }
  };

  // Pre-calculate multi-table context for Join dropdowns
  const fromBlockForContext = queryBlocks.find(b => b.type === 'from');
  const joinBlockForContext = queryBlocks.find(b => b.type === 'join');
  const allTables = {};
  if (fromBlockForContext?.data.table && dbSchema[fromBlockForContext.data.table]) {
    allTables[fromBlockForContext.data.table] = dbSchema[fromBlockForContext.data.table];
  }
  if (joinBlockForContext?.data.table && dbSchema[joinBlockForContext.data.table]) {
    allTables[joinBlockForContext.data.table] = dbSchema[joinBlockForContext.data.table];
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', fontFamily: 'sans-serif' }}>
        <header style={{ background: '#282c34', padding: '1rem', color: 'white', textAlign: 'center', flexShrink: 0 }}>
          <h1>Visual SQL Query Builder</h1>
        </header>

        <main style={{ display: 'flex', flex: 1, borderTop: '1px solid #ddd', overflow: 'hidden', width: '100%' }}>

          <BlockPalette />

          <Workspace
            blocks={queryBlocks}
            allTables={allTables}
            schema={dbSchema}
            updateBlockData={updateBlockData}
            onGenerateSql={handleGenerateSql}
            handleDeleteBlock={handleDeleteBlock}
            onClearWorkspace={handleClearWorkspace}
          />

          <div
            style={{
              flex: 2,
              minWidth: 0,
              borderLeft: '2px solid #ccc',
              overflowY: 'auto',
              background: '#fafafa'
            }}
          >
            <ResultsTable
              results={queryResults}
              error={error} 
              generatedSql={generatedSql}
              loading={loading}
            />
          </div>
        </main>
      </div>
    </DndContext>
  );
}

export default App;
