// src/DraggableBlock.jsx
import React from 'react';
import { useDraggable } from '@dnd-kit/core';

function DraggableBlock({ id, children }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    cursor: 'grabbing',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)', // Add shadow when dragging
  } : {
    cursor: 'grab',
  };

  const blockStyle = {
    background: 'white',
    border: '1px solid #ccc',
    padding: '8px 12px',
    marginBottom: '8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    touchAction: 'none', // Important for touch devices
  };

  return (
    <div ref={setNodeRef} style={{ ...blockStyle, ...style }} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

export default DraggableBlock;