'use client';

import { useRef, useState, useLayoutEffect } from 'react';
import { GridItem as GridItemComponent } from './GridItem';
import type { GridItem } from '@/types/grid';
import type { ResizeDirection } from '@/hooks/useGridEngine';

interface GridCanvasProps {
  layout: GridItem[];
  columnCount: number;
  rowHeight: number; // engine's row height state (may differ from cellSize)
  selectedItemId: string | null;
  onSelectItem: (itemId: string | null) => void;
  onAddItem: (pixelX: number, pixelY: number, containerRect: DOMRect) => void;
  onMoveItem: (itemId: string, col: number, row: number) => void;
  onResizeItem: (
    itemId: string,
    direction: ResizeDirection,
    deltaX: number,
    deltaY: number,
    containerRect: DOMRect
  ) => void;
  onRemoveItem: (itemId: string) => void;
}

export function GridCanvas({
  layout,
  columnCount,
  rowHeight, // engine row height (passed through to items)
  selectedItemId,
  onSelectItem,
  onAddItem,
  onMoveItem,
  onResizeItem,
  onRemoveItem,
}: GridCanvasProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(40); // square cell size in pixels

  // Calculate square cell size based on container width
  useLayoutEffect(() => {
    const updateCellSize = () => {
      if (!gridRef.current) return;
      const width = gridRef.current.offsetWidth;
      const colWidth = width / columnCount;
      setCellSize(colWidth);
    };

    updateCellSize();
    window.addEventListener('resize', updateCellSize);
    return () => window.removeEventListener('resize', updateCellSize);
  }, [columnCount]);

  const handleGridClick = (e: React.MouseEvent) => {
    // clear selection if clicking on empty grid
    if (e.target === gridRef.current) {
      onSelectItem(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    if (!gridRef.current) return;

    const data = e.dataTransfer.getData('text/plain');
    if (data !== 'palette-item') return;

    const rect = gridRef.current.getBoundingClientRect();
    onAddItem(e.clientX, e.clientY, rect);
  };

  // Single grid background pattern with square cells
  const backgroundStyle = {
    backgroundImage: 
      'linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),' +
      'linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)',
    backgroundSize: `${cellSize}px ${cellSize}px`,
    backgroundPosition: '0 0',
  };

  return (
    <div
      ref={gridRef}
      onClick={handleGridClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gridAutoRows: `${cellSize}px`,
        gap: '0',
        width: '100%',
        minHeight: '100%',
        ...backgroundStyle,
      }}
      className="relative bg-gray-50"
    >
      {layout.map((item) => (
        <GridItemComponent
          key={item.id}
          item={item}
          isSelected={selectedItemId === item.id}
          onSelect={onSelectItem}
          onResize={onResizeItem}
          onRemove={onRemoveItem}
          onMove={onMoveItem}
          containerRef={gridRef}
          columnCount={columnCount}
          cellSize={cellSize}
          rowHeight={rowHeight}
        />
      ))}
    </div>
  );
}
