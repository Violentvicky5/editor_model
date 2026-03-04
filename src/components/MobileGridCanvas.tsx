'use client';

import { useRef, useState } from 'react';
import { MobileGridItem } from './MobileGridItem';
import type { GridItem } from '@/types/grid';

interface MobileGridCanvasProps {
  layout: GridItem[];
  selectedItemPath: string[];
  onSelectItem: (path: string[]) => void;
  onReorderItem: (path: string[], fromIndex: number, toIndex: number) => void;
}

export function MobileGridCanvas({
  layout,
  selectedItemPath,
  onSelectItem,
  onReorderItem,
}: MobileGridCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedItem, setDraggedItem] = useState<{
    path: string[];
    index: number;
  } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onSelectItem([]);
    }
  };

  const handleDragStart = (itemPath: string[], index: number) => {
    setDraggedItem({ path: itemPath, index });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (draggedItem && draggedItem.index !== toIndex) {
      // Reorder at root level (empty path)
      onReorderItem([], draggedItem.index, toIndex);
    }

    setDraggedItem(null);
  };

  // If no items, show empty state
  if (!layout || layout.length === 0) {
    return (
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="w-full p-4 flex items-center justify-center"
      >
        <p className="text-center text-gray-400">No items yet</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="w-full flex flex-col gap-2 p-3 min-h-0 rounded-4xl"
    >
      {layout.map((item, index) => (
        <div
          key={item.id}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={`transition-opacity ${
            dragOverIndex === index && draggedItem ? 'opacity-50' : ''
          }`}
        >
          <MobileGridItem
            item={item}
            itemPath={[item.id]}
            itemIndex={index}
            containerPath={[]}
            selectedItemPath={selectedItemPath}
            onSelect={onSelectItem}
            onReorder={onReorderItem}
            onDragStart={handleDragStart}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * MobileGridCanvas Component
 * -------------------------
 * Root mobile grid container (vertical flex layout)
 *
 * Features:
 * - Renders items in vertical stack (flex column)
 * - Full width, auto height
 * - No grid positioning
 * - Supports vertical reordering via drag-and-drop
 * - Handles nested containers with proper styling
 * - Simple click to select items
 *
 * Does NOT support:
 * - Grid layout
 * - Horizontal dragging
 * - Resizing
 * - Collision detection
 */

