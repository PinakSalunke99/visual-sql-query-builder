// src/BlockPalette.jsx
import React from 'react';
import DraggableBlock from './DraggableBlock';

function BlockPalette() {
  const style = {
    width: '200px',
    borderRight: '2px solid #ccc',
    padding: '1rem',
    background: '#f4f4f4',
    overflowY: 'auto',
  };

  return (
    <div style={style}>
      <h2>Commands</h2>
      <DraggableBlock id="select-block">SELECT</DraggableBlock>
      <DraggableBlock id="from-block">FROM</DraggableBlock>
      <DraggableBlock id="join-block">JOIN</DraggableBlock> {/* --- ADDED JOIN --- */}
      <DraggableBlock id="where-block">WHERE</DraggableBlock>
      <DraggableBlock id="orderby-block">ORDER BY</DraggableBlock>

      <h3 style={{marginTop: '20px'}}>Aggregates</h3>
      <DraggableBlock id="groupby-block">GROUP BY</DraggableBlock>
      <DraggableBlock id="count-block">COUNT</DraggableBlock>
      <DraggableBlock id="avg-block">AVG</DraggableBlock>
      <DraggableBlock id="sum-block">SUM</DraggableBlock>

      <h3 style={{marginTop: '20px'}}>Modify</h3>
      <DraggableBlock id="insert-block">INSERT</DraggableBlock>
      <DraggableBlock id="delete-block">DELETE</DraggableBlock>
      <DraggableBlock id="update-block">UPDATE</DraggableBlock>
    </div>
  );
}

export default BlockPalette;
