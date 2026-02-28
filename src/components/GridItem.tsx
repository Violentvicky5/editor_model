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
  cellSize: number;
  rowHeight: number; // engine row height used for delta->rows conversion
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
  cellSize,
  rowHeight,
}: GridItemProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<ResizeDirection | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resizeStateRef = useRef<{
    startX: number;
    startY: number;
    direction: ResizeDirection | null;
    lastX?: number;
    lastY?: number;
  }>({ startX: 0, startY: 0, direction: null });

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    lastX?: number;
    lastY?: number;
  }>({ startX: 0, startY: 0, offsetX: 0, offsetY: 0 });

  // accumulators for controlled snapping
  const deltaAccumulatorXRef = useRef(0);
  const deltaAccumulatorYRef = useRef(0);

  const dragAccumulatorXRef = useRef(0);
  const dragAccumulatorYRef = useRef(0);

  // initial rect snapshot to avoid initial jump
  const initialRectRef = useRef({ colStart: item.colStart, colEnd: item.colEnd, rowStart: item.rowStart, rowEnd: item.rowEnd });

  const rafIdRef = useRef<number | null>(null);

  // Unified pointer move handler with RAF batching and snapping accumulators
  const handlePointerMove = (e: PointerEvent) => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    rafIdRef.current = requestAnimationFrame(() => {
      if (isResizing && resizeStateRef.current.direction && containerRef.current) {
        const dir = resizeStateRef.current.direction;
        const rect = containerRef.current.getBoundingClientRect();

        // compute delta relative to initial pointer down
        const deltaX = e.clientX - (resizeStateRef.current.lastX ?? resizeStateRef.current.startX);
        const deltaY = e.clientY - (resizeStateRef.current.lastY ?? resizeStateRef.current.startY);

        // update last pointer so next call is incremental
        resizeStateRef.current.lastX = e.clientX;
        resizeStateRef.current.lastY = e.clientY;

        // accumulate movement
        deltaAccumulatorXRef.current += deltaX;
        deltaAccumulatorYRef.current += deltaY;

        // horizontal snapping (unchanged)
        if (['e', 'w', 'ne', 'nw', 'se', 'sw'].includes(dir)) {
          while (Math.abs(deltaAccumulatorXRef.current) >= cellSize) {
            const step = Math.sign(deltaAccumulatorXRef.current);
            const px = step * cellSize;
            onResize(item.id, dir, px, 0, rect);
            deltaAccumulatorXRef.current -= step * cellSize;
          }
        }

        // vertical snapping using engine rowHeight for proper conversion
        if (['n', 's', 'ne', 'nw', 'se', 'sw'].includes(dir)) {
          while (Math.abs(deltaAccumulatorYRef.current) >= cellSize) {
            const step = Math.sign(deltaAccumulatorYRef.current);
            // compute pixel delta based on engine rowHeight so engine increments rows correctly
            const py = step * rowHeight;
            onResize(item.id, dir, 0, py, rect);
            deltaAccumulatorYRef.current -= step * cellSize;
          }
        }

        return; // skip drag logic during resizing
      }

      if (isDragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();

        const movementX = e.clientX - (dragStateRef.current.lastX ?? dragStateRef.current.startX);
        const movementY = e.clientY - (dragStateRef.current.lastY ?? dragStateRef.current.startY);
        dragStateRef.current.lastX = e.clientX;
        dragStateRef.current.lastY = e.clientY;

        dragAccumulatorXRef.current += movementX;
        dragAccumulatorYRef.current += movementY;

        // horizontal snap steps
        while (Math.abs(dragAccumulatorXRef.current) >= cellSize) {
          const step = Math.sign(dragAccumulatorXRef.current);
          const newCol = Math.max(0, initialRectRef.current.colStart + step);
          onMove(item.id, newCol, initialRectRef.current.rowStart);
          initialRectRef.current.colStart = newCol;
          dragAccumulatorXRef.current -= step * cellSize;
        }

        // vertical snap steps
        while (Math.abs(dragAccumulatorYRef.current) >= cellSize) {
          const step = Math.sign(dragAccumulatorYRef.current);
          const newRow = Math.max(0, initialRectRef.current.rowStart + step);
          onMove(item.id, initialRectRef.current.colStart, newRow);
          initialRectRef.current.rowStart = newRow;
          dragAccumulatorYRef.current -= step * cellSize;
        }
      }
    });
  };

  const handlePointerUp = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setIsResizing(false);
    setResizeDir(null);
    setIsDragging(false);
    document.removeEventListener('pointermove', handlePointerMove as EventListener);
    document.removeEventListener('pointerup', handlePointerUp);
  };

  useEffect(() => {
    if (isResizing || isDragging) {
      document.addEventListener('pointermove', handlePointerMove as EventListener);
      document.addEventListener('pointerup', handlePointerUp);
      return () => {
        document.removeEventListener('pointermove', handlePointerMove as EventListener);
        document.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isResizing, isDragging, item.id, onResize, onMove, cellSize, containerRef]);

  const startResize = (dir: ResizeDirection) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    // snapshot initial rect to avoid initial jump
    initialRectRef.current = { colStart: item.colStart, colEnd: item.colEnd, rowStart: item.rowStart, rowEnd: item.rowEnd };

    // reset accumulators
    deltaAccumulatorXRef.current = 0;
    deltaAccumulatorYRef.current = 0;

    // cancel ongoing drag if any
    setIsDragging(false);
    resizeStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      direction: dir,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    setResizeDir(dir);
    setIsResizing(true);
  };

  const handleDragStart = (e: React.PointerEvent) => {
    if (isResizing) return;
    onSelect(item.id);
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = e.clientX - (rect.left + item.colStart * cellSize);
    const offsetY = e.clientY - (rect.top + item.rowStart * cellSize);

    // snapshot initial rect and reset accumulators
    initialRectRef.current = { colStart: item.colStart, colEnd: item.colEnd, rowStart: item.rowStart, rowEnd: item.rowEnd };
    dragAccumulatorXRef.current = 0;
    dragAccumulatorYRef.current = 0;

    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX,
      offsetY,
      lastX: e.clientX,
      lastY: e.clientY,
    };

    setIsDragging(true);
  };

  const width = item.colEnd - item.colStart;
  const height = item.rowEnd - item.rowStart;

  return (
    <div
      onClick={() => onSelect(item.id)}
      onPointerDown={handleDragStart}
      style={{
        gridColumn: `${item.colStart + 1} / span ${width}`,
        gridRow: `${item.rowStart + 1} / span ${height}`,
      }}
      className={`relative border-2 rounded-lg p-4 transition-all touch-action-none ${
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
            onPointerDown={(e: React.PointerEvent) => {
              e.stopPropagation();
              e.preventDefault();
              // try to release any pointer capture on the container to ensure click works
              try {
                containerRef.current?.releasePointerCapture?.(e.pointerId);
              } catch (_) {}
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
              } catch (_) {}
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
            onPointerDown={startResize('nw')}
            className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nwse-resize hover:bg-blue-600 pointer-events-auto touch-action-none"
            title="Resize NW"
          />
          <div
            onPointerDown={startResize('ne')}
            className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nesw-resize hover:bg-blue-600 pointer-events-auto touch-action-none"
            title="Resize NE"
          />
          <div
            onPointerDown={startResize('sw')}
            className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nesw-resize hover:bg-blue-600 pointer-events-auto touch-action-none"
            title="Resize SW"
          />
          <div
            onPointerDown={startResize('se')}
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nwse-resize hover:bg-blue-600 pointer-events-auto touch-action-none"
            title="Resize SE"
          />

          {/* Edge handles - 12px hitbox for easier interaction */}
          <div
            onPointerDown={startResize('n')}
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-8 cursor-n-resize hover:bg-blue-500/20 pointer-events-auto touch-action-none"
            title="Resize N"
          />
          <div
            onPointerDown={startResize('s')}
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-8 cursor-s-resize hover:bg-blue-500/20 pointer-events-auto touch-action-none"
            title="Resize S"
          />
          <div
            onPointerDown={startResize('w')}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 cursor-w-resize hover:bg-blue-500/20 pointer-events-auto touch-action-none"
            title="Resize W"
          />
          <div
            onPointerDown={startResize('e')}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 cursor-e-resize hover:bg-blue-500/20 pointer-events-auto touch-action-none"
            title="Resize E"
          />
        </>
      )}
    </div>
  );
}
