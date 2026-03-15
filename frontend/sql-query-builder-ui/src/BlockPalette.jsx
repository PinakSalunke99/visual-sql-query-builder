// src/BlockPalette.jsx

import React from 'react';
import DraggableBlock from './DraggableBlock';

function BlockPalette() {
  const style = {
    width: '220px', // Slightly wider for better text fit
    borderRight: '2px solid #ccc',
    padding: '1rem',
    background: '#f4f4f4',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  };

  const headerStyle = {
    fontSize: '1.2rem',
    margin: '15px 0 10px 0',
    color: '#333',
    borderBottom: '1px solid #ddd',
    paddingBottom: '5px'
  };

  return (
    <div style={style}>
      <h2 style={{ marginTop: 0 }}>Commands</h2>
      
      {/* Standard Query Blocks */}
      <DraggableBlock id="select-block">SELECT</DraggableBlock>
      <DraggableBlock id="from-block">FROM</DraggableBlock>
      <DraggableBlock id="join-block">JOIN</DraggableBlock>
      <DraggableBlock id="where-block">WHERE</DraggableBlock>
      <DraggableBlock id="orderby-block">ORDER BY</DraggableBlock>

      <h3 style={headerStyle}>Aggregates</h3>
      <DraggableBlock id="groupby-block">GROUP BY</DraggableBlock>
      <DraggableBlock id="count-block">COUNT</DraggableBlock>
      <DraggableBlock id="avg-block">AVG</DraggableBlock>
      <DraggableBlock id="sum-block">SUM</DraggableBlock>

      <h3 style={headerStyle}>Modify</h3>
      {/* --- NEW CREATE TABLE BLOCK --- */}
      <DraggableBlock id="create-block">CREATE TABLE</DraggableBlock>
      
      <DraggableBlock id="insert-block">INSERT</DraggableBlock>
      <DraggableBlock id="delete-block">DELETE</DraggableBlock>
      <DraggableBlock id="update-block">UPDATE</DraggableBlock>
    </div>
  );
}

export default BlockPalette;
