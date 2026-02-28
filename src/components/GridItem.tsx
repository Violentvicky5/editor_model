'use client';

import { useRef, useEffect, useState } from 'react';
import { GridItem as GridItemType } from '@/types/grid';
import { ResizeDirection } from '@/hooks/useGridEngine';

interface GridItemProps {
  item: GridItemType;
  isSelected: boolean;
  onSelect: (itemId: string) => void;
  onResize: (
    itemId: string,
    direction: ResizeDirection,
    deltaX: number,
    deltaY: number,
    containerRect: DOMRect
  ) => void;
  onMove: (itemId: string, col: number, row: number) => void;
  onRemove: (itemId: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  columnCount: number;
  rowHeight: number;
}

export function GridItem({
  item,
  isSelected,
  onSelect,
  onResize,
  onMove,
  onRemove,
  containerRef,
  columnCount,
  rowHeight,
}: GridItemProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<ResizeDirection | null>(null);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  useEffect(() => {
    if (!isResizing && !isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (isResizing && resizeDir && containerRef.current) {
        onResize(item.id, resizeDir, deltaX, deltaY, containerRef.current.getBoundingClientRect());
      }

      if (isDragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const colWidth = rect.width / columnCount;
        const relativeX = e.clientX - rect.left - dragOffsetX;
        const relativeY = e.clientY - rect.top - dragOffsetY;
        const newCol = Math.floor(Math.max(0, Math.min(relativeX, rect.width - 1) / colWidth));
        const newRow = Math.floor(Math.max(0, relativeY / rowHeight));
        onMove(item.id, newCol, newRow);
      }

      setStartX(e.clientX);
      setStartY(e.clientY);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDir(null);
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDir, isDragging, startX, startY, dragOffsetX, dragOffsetY, item.id, onResize, onMove, columnCount, rowHeight, containerRef]);

  const startResize = (dir: ResizeDirection) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeDir(dir);
    setStartX(e.clientX);
    setStartY(e.clientY);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (isResizing) return;
    onSelect(item.id); // select on drag start
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const colWidth = rect.width / columnCount;
    const offsetX = e.clientX - (rect.left + item.colStart * colWidth);
    const offsetY = e.clientY - (rect.top + item.rowStart * rowHeight);
    setDragOffsetX(offsetX);
    setDragOffsetY(offsetY);
    setIsDragging(true);
    setStartX(e.clientX);
    setStartY(e.clientY);
  };

  const width = item.colEnd - item.colStart;
  const height = item.rowEnd - item.rowStart;

  return (
    <div
      onClick={() => onSelect(item.id)}
      onMouseDown={handleDragStart}
      style={{
        gridColumn: `${item.colStart + 1} / span ${width}`,
        gridRow: `${item.rowStart + 1} / span ${height}`,
      }}
      className={`relative border-2 rounded-lg p-4 transition-all ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-300 bg-white shadow-sm hover:shadow-md hover:border-gray-400'
      } ${isDragging ? 'shadow-lg z-10' : 'z-0'}`}
    >
      <div className="absolute inset-0 p-4 flex flex-col pointer-events-none">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Item {item.id.slice(-6)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="text-xs text-red-500 hover:text-red-700 font-medium pointer-events-auto"
          >
            ✕
          </button>
        </div>
        <div className="text-xs text-gray-500">
          <div>Col: {item.colStart + 1} - {item.colEnd}</div>
          <div>Row: {item.rowStart + 1} - {item.rowEnd}</div>
          <div>Size: {width}×{height}</div>
        </div>
      </div>

      {/* Resize handles - only show if selected */}
      {isSelected && (
        <>
          {/* Corner handles - 10x10px with bigger hitbox via pseudo-positioning */}
          <div
            onMouseDown={startResize('nw')}
            className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nwse-resize hover:bg-blue-600 pointer-events-auto"
            title="Resize NW"
          />
          <div
            onMouseDown={startResize('ne')}
            className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nesw-resize hover:bg-blue-600 pointer-events-auto"
            title="Resize NE"
          />
          <div
            onMouseDown={startResize('sw')}
            className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nesw-resize hover:bg-blue-600 pointer-events-auto"
            title="Resize SW"
          />
          <div
            onMouseDown={startResize('se')}
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nwse-resize hover:bg-blue-600 pointer-events-auto"
            title="Resize SE"
          />

          {/* Edge handles - 12px hitbox for easier interaction */}
          <div
            onMouseDown={startResize('n')}
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-8 cursor-n-resize hover:bg-blue-500/20 pointer-events-auto"
            title="Resize N"
          />
          <div
            onMouseDown={startResize('s')}
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-8 cursor-s-resize hover:bg-blue-500/20 pointer-events-auto"
            title="Resize S"
          />
          <div
            onMouseDown={startResize('w')}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 cursor-w-resize hover:bg-blue-500/20 pointer-events-auto"
            title="Resize W"
          />
          <div
            onMouseDown={startResize('e')}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 cursor-e-resize hover:bg-blue-500/20 pointer-events-auto"
            title="Resize E"
          />
        </>
      )}
    </div>
  );
}
