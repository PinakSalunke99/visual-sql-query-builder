// src/App.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DndContext } from '@dnd-kit/core';
import BlockPalette from './BlockPalette';
import Workspace from './Workspace';
import ResultsTable from './ResultsTable';

const API_BASE_URL = 'http://127.0.0.1:5000';

function App() {
  const [dbSchema, setDbSchema] = useState({});
  const [queryBlocks, setQueryBlocks] = useState([]);
  const [queryResults, setQueryResults] = useState(null);
  const [generatedSql, setGeneratedSql] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/schema`)
      .then(response => setDbSchema(response.data))
      .catch(error => {
        console.error("Error fetching schema:", error);
        setError("Could not connect to backend. Is the Flask server running?");
      });
  }, []);

  // Simplified handleDragEnd for adding blocks ONLY
  function handleDragEnd(event) {
    const { active, over } = event;
    if (over && over.id === 'workspace' && typeof active.id === 'string' && active.id.includes('-block')) {
      const type = active.id.split('-')[0];
      let initialData = {};
      if (type === 'where') initialData = { logical_operator: 'AND', rules: [{ column: '', operator: '=', value: '' }] };
      else if (type === 'delete') initialData = { operator: '=' };
      else if (type === 'update') initialData = { where_operator: '=' };
      else if (type === 'orderby') initialData = { direction: 'ASC' };
      else if (type === 'count' || type === 'avg' || type === 'sum') initialData = { column: '*' };
      else if (type === 'join') initialData = { type: 'INNER' };
      const newBlock = { id: Date.now(), type: type, data: initialData };
      setQueryBlocks(prev => [...prev, newBlock]);
    } else {
        console.log("Drag ended outside workspace or was not from palette.");
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

  const handleGenerateSql = async () => {
    setError('');
    setQueryResults(null);
    setGeneratedSql('');
    setLoading(true); // START LOADING

    if (queryBlocks.length === 0) {
      setError("Workspace is empty.");
      setLoading(false); // STOP LOADING on early exit
      return;
    }

    // Determine query type - Now check *any* block, not just first, for safety
    const hasInsert = queryBlocks.some(b => b.type === 'insert');
    const hasDelete = queryBlocks.some(b => b.type === 'delete');
    const hasUpdate = queryBlocks.some(b => b.type === 'update');
    const hasFrom = queryBlocks.some(b => b.type === 'from');

    let commandJson = {};
    let queryTypeForJson = 'SELECT'; // Default assumption if FROM/SELECT exist

    // Prioritize modification types if present (assuming only one modification block)
    if (hasInsert) {
        queryTypeForJson = 'INSERT';
        const insertBlock = queryBlocks.find(b => b.type === 'insert');
        if (!insertBlock || !insertBlock.data.table) { setError("INSERT block must have a selected table."); setLoading(false); return; }
        commandJson = { query_type: "INSERT", table_name: insertBlock.data.table, values: insertBlock.data.values || {}, };
    } else if (hasDelete) {
        queryTypeForJson = 'DELETE';
        const deleteBlock = queryBlocks.find(b => b.type === 'delete');
        if (!deleteBlock) { setError("DELETE block not found."); setLoading(false); return;} // Added check
        const data = deleteBlock.data;
        if (!data.table || !data.column || !data.operator || data.value === undefined || data.value === null || data.value === '') { setError("DELETE statements must be complete (table, column, operator, value)."); setLoading(false); return; }
        commandJson = { query_type: "DELETE", table_name: data.table, conditions: { logical_operator: "AND", rules: [{ column: data.column, operator: data.operator, value: data.value }] } };
    } else if (hasUpdate) {
        queryTypeForJson = 'UPDATE';
        const updateBlock = queryBlocks.find(b => b.type === 'update');
        if (!updateBlock) { setError("UPDATE block not found."); setLoading(false); return;} // Added check
        const data = updateBlock.data;
        if (!data.table || !data.set_column || data.set_value === undefined || !data.where_column || !data.where_operator || data.where_value === undefined || data.where_value === null || data.where_value === '') { setError("UPDATE statements must be complete (table, SET col/val, WHERE col/op/val)."); setLoading(false); return; }
        commandJson = { query_type: "UPDATE", table_name: data.table, assignments: { [data.set_column]: data.set_value }, conditions: { logical_operator: "AND", rules: [{ column: data.where_column, operator: data.where_operator, value: data.where_value }] } };
    }
    // If none of the above, assume SELECT if a FROM block exists
    else if (hasFrom) {
      queryTypeForJson = 'SELECT';
      const fromBlock = queryBlocks.find(b => b.type === 'from');
      // No need for !fromBlock check because of hasFrom

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
        commandJson.join = { type: joinBlock.data.type || 'INNER', table: joinBlock.data.table, on_col1: joinBlock.data.on_col1, on_col2: joinBlock.data.on_col2 };
      }

      // Build nested conditions from ALL WHERE blocks
      if (whereBlocks.length > 0) {
        const whereGroups = whereBlocks.map(block => {
          if (block.data.rules && block.data.rules.length > 0) {
            const validRules = block.data.rules.filter( rule => rule.column && rule.operator && rule.value !== undefined && rule.value !== null && rule.value !== '' );
            if (validRules.length > 0) { return { logical_operator: block.data.logical_operator || 'AND', rules: validRules }; }
          }
          return null;
        }).filter(Boolean);
        if (whereGroups.length === 1) { commandJson.conditions = whereGroups[0]; }
        else if (whereGroups.length > 1) { commandJson.conditions = { logical_operator: "OR", rules: whereGroups }; }
      }

      if (orderbyBlock && orderbyBlock.data.column) { commandJson.orderby = { column: orderbyBlock.data.column, direction: orderbyBlock.data.direction || 'ASC' }; }
      if (groupbyBlock && groupbyBlock.data.column) { commandJson.groupby = groupbyBlock.data.column; }
      if (aggregateBlocks.length > 0) { commandJson.aggregates = aggregateBlocks.map(block => ({ function: block.type, column: block.data.column || '*' })); }

      // Default selection handled by backend if needed
    }
    // Handle invalid query structure (e.g., only WHERE block without FROM)
    else {
        setError(`Invalid query structure. Missing FROM block for SELECT or modification block (INSERT/UPDATE/DELETE).`);
        setLoading(false);
        return;
    }


    // --- API Call ---
    try {
      console.log("Sending JSON to backend:", JSON.stringify(commandJson, null, 2));
      const response = await axios.post(`${API_BASE_URL}/api/generate-sql`, commandJson);
      console.log("Received response from backend:", response.data);
      if (response.data.status === 'success') {
        setQueryResults(response.data.data);
        setGeneratedSql(response.data.generated_sql);
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
      setLoading(false); // STOP LOADING, whether success or error
    }
  };

  // --- Calculate allTables for passing down ---
  const fromBlockForContext = queryBlocks.find(b => b.type === 'from');
  const joinBlockForContext = queryBlocks.find(b => b.type === 'join');
  const allTables = {};
  if (fromBlockForContext?.data.table && dbSchema[fromBlockForContext.data.table]) {
    allTables[fromBlockForContext.data.table] = dbSchema[fromBlockForContext.data.table];
  }
  if (joinBlockForContext?.data.table && dbSchema[joinBlockForContext.data.table]) {
    allTables[joinBlockForContext.data.table] = dbSchema[joinBlockForContext.data.table];
  }
  // --- END CALCULATION ---

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {/* --- Root Div Takes Full Width --- */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', fontFamily: 'sans-serif' }}>
        <header style={{ background: '#282c34', padding: '1rem', color: 'white', textAlign: 'center', flexShrink: 0 }}> {/* Added flexShrink */}
          <h1>Visual SQL Query Builder</h1>
        </header>

        {/* --- Main Takes Full Width and Height --- */}
        <main style={{ display: 'flex', flex: 1, borderTop: '1px solid #ddd', overflow: 'hidden', width: '100%' }}>

          <BlockPalette /> {/* Fixed width handled internally */}

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
              flex: 2, // Adjust flex ratio if needed
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
              loading={loading} // Pass loading state down
            />
          </div>
        </main>

      </div>
    </DndContext>
  );
}

export default App;