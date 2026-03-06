// src/SortableItem.jsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableItem(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: '5px',
    // Add zIndex while dragging to ensure it renders above other items
    zIndex: isDragging ? 100 : 'auto',
    position: 'relative', // Needed for zIndex stacking context
  };

  // Extract props specifically for useSortable
  const { id, children, ...restProps } = props;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* Pass all remaining props down to the actual QueryBlock */}
      {React.cloneElement(children, restProps)}
    </div>
  );
}