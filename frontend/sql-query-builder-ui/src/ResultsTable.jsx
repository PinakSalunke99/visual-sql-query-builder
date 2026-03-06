// src/ResultsTable.jsx

import React, { useState } from 'react';

// Receive the new 'loading' prop
function ResultsTable({ results, error, generatedSql, loading }) {
  const [copyButtonText, setCopyButtonText] = useState('Copy SQL');

  const handleCopyClick = () => {
    if (generatedSql) {
      navigator.clipboard.writeText(generatedSql)
        .then(() => {
          setCopyButtonText('Copied!');
          setTimeout(() => setCopyButtonText('Copy SQL'), 2000);
        })
        .catch(err => {
          console.error('Failed to copy SQL:', err);
          setCopyButtonText('Error!');
          setTimeout(() => setCopyButtonText('Copy SQL'), 2000);
        });
    }
  };

  const renderContent = () => {
    // --- ADD THIS CHECK AT THE BEGINNING ---
    if (loading) {
      return <p style={{ padding: '1rem', color: '#555', fontStyle: 'italic' }}>Loading results...</p>;
    }
    // --- END OF ADDED CHECK ---

    if (error) {
      return <div style={{ color: 'red', padding: '1rem' }}><strong>Error:</strong> {error}</div>;
    }
    if (!results) {
      return <p style={{ padding: '1rem', color: '#555' }}>Query results will appear here.</p>;
    }
    if (results.message) {
      return (
        <div style={{ color: 'green', padding: '1rem', fontWeight: 'bold' }}>
          <p>✅ {results.message}</p>
          <p>Rows Affected: {results.rows_affected}</p>
        </div>
      );
    }
    if (results.query_results) {
      const data = results.query_results;
      if (data.length === 0) {
        return <p style={{ padding: '1rem' }}>Query executed successfully, but returned no results.</p>;
      }
      const headers = Object.keys(data[0]);
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ background: '#f2f2f2' }}>
              {headers.map(header => <th key={header} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map(header => <td key={`${rowIndex}-${header}`} style={{ border: '1px solid #ddd', padding: '8px' }}>{row[header]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return <p style={{ padding: '1rem' }}>Query results will appear here.</p>;
  };

  const sqlContainerStyle = {
    position: 'relative',
    background: '#282c34',
    color: '#f0f0f0',
    fontFamily: 'monospace',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    whiteSpace: 'pre-wrap',
    paddingRight: '80px'
  };

  const copyButtonStyle = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    padding: '5px 10px',
    background: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Results</h2>
      {generatedSql && (
        <div style={sqlContainerStyle}>
          {generatedSql}
          <button style={copyButtonStyle} onClick={handleCopyClick}>
            {copyButtonText}
          </button>
        </div>
      )}
      {renderContent()}
    </div>
  );
}

export default ResultsTable;