'use client';

import { useRef, useState, useLayoutEffect } from 'react';
import { GridItem as GridItemComponent } from './GridItem';
import type { GridItem } from '@/types/grid';
import type { ResizeDirection } from '@/hooks/useGridEngine';

interface GridCanvasProps {
  layout: GridItem[];
  columnCount: number;
  rowHeight: number;
  selectedItemPath: string[];
  onSelectItem: (path: string[]) => void;
  onAddItem: (pixelX: number, pixelY: number, containerRect: DOMRect, targetPath: string[]) => void;
  onMoveItem: (path: string[], col: number, row: number) => void;
  onResizeItem: (
    path: string[],
    direction: ResizeDirection,
    deltaX: number,
    deltaY: number,
    containerRect: DOMRect
  ) => void;
  onRemoveItem: (path: string[]) => void;
  onInitializeChildren: (path: string[]) => void;
}

export function GridCanvas({
  layout,
  columnCount,
  rowHeight,
  selectedItemPath,
  onSelectItem,
  onAddItem,
  onMoveItem,
  onResizeItem,
  onRemoveItem,
  onInitializeChildren,
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
      onSelectItem([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    // ignore drops from nested grids: event should originate on this container
    if (e.currentTarget !== e.target) return;

    e.preventDefault();

    const data = e.dataTransfer.getData('text/plain');
    if (data !== 'palette-item') return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    onAddItem(e.clientX, e.clientY, rect, []);
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
          itemPath={[item.id]}
          selectedItemPath={selectedItemPath}
          onSelect={onSelectItem}
          onAddItem={onAddItem}
          onResize={onResizeItem}
          onRemove={onRemoveItem}
          onMove={onMoveItem}
          onInitializeChildren={onInitializeChildren}
          containerRef={gridRef}
          columnCount={columnCount}
          cellSize={cellSize}
          rowHeight={rowHeight}
          depth={0}
        />
      ))}
    </div>
  );
}

/**
 * GridCanvas Component
 * --------------------
 * Root grid container responsible for:
 *
 * - Rendering the top-level grid layout using CSS Grid.
 * - Calculating dynamic square cell size based on container width.
 * - Rendering all root GridItem components.
 * - Handling background click to clear selection.
 * - Handling drag-over and drop events for adding new items from palette.
 * - Converting drop position into grid coordinates via container rect.
 *
 * This component does NOT handle layout logic or collision resolution.
 * It acts purely as the visual grid surface and event delegator.
 */