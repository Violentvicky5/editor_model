"use client";

import React, { useRef, useEffect, useState } from "react";
import { GridItem as GridItemType } from "@/types/grid";
import { ResizeDirection } from "@/hooks/useGridEngine";
import Icon from '@mdi/react';
import { mdiDelete } from '@mdi/js';
interface GridItemProps {
  item: GridItemType;
  itemPath: string[]; // Path to this item
  selectedItemPath: string[]; // Global selected path (for comparison)
  onSelect: (path: string[]) => void;
  onAddItem: (
    pixelX: number,
    pixelY: number,
    containerRect: DOMRect,
    targetPath: string[],
  ) => void;
  onResize: (
    path: string[],
    direction: ResizeDirection,
    deltaX: number,
    deltaY: number,
    containerRect: DOMRect,
  ) => void;
  onMove: (path: string[], col: number, row: number) => void;
  onRemove: (path: string[]) => void;

  containerRef: React.RefObject<HTMLDivElement | null>;
  columnCount: number;
  cellSize: number;
  rowHeight: number;
  depth: number; // Nesting depth
  maxDepth?: number; // Max nesting depth (default 10)
}

export function GridItem({
  item,
  itemPath,
  selectedItemPath,
  onSelect,
  onAddItem,
  onResize,
  onMove,
  onRemove,

  containerRef,
  columnCount,
  cellSize,
  rowHeight,
  depth,
  maxDepth = 10,
}: GridItemProps) {
  // debug render tracing
  // eslint-disable-next-line no-console
  console.log("GridItem render", item.id);

  // Selection is determined by full path match to support deep nesting
  const isSelected =
    itemPath.length === selectedItemPath.length &&
    itemPath.every((id, i) => id === selectedItemPath[i]);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<ResizeDirection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

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
  const initialRectRef = useRef({
    colStart: item.colStart,
    colEnd: item.colEnd,
    rowStart: item.rowStart,
    rowEnd: item.rowEnd,
  });

  const rafIdRef = useRef<number | null>(null);

  // Unified pointer move handler with RAF batching and snapping accumulators
  const handlePointerMove = (e: PointerEvent) => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    rafIdRef.current = requestAnimationFrame(() => {
      // Resize logic: convert pointer delta to grid units,
      // clamp within parent boundaries, and update immutably
      if (
        isResizing &&
        resizeStateRef.current.direction &&
        containerRef.current
      ) {
        const dir = resizeStateRef.current.direction;
        const rect = containerRef.current.getBoundingClientRect();
        const localCellSize = rect.width / columnCount;

        // compute delta relative to initial pointer down
        const deltaX =
          e.clientX -
          (resizeStateRef.current.lastX ?? resizeStateRef.current.startX);
        const deltaY =
          e.clientY -
          (resizeStateRef.current.lastY ?? resizeStateRef.current.startY);

        // update last pointer so next call is incremental
        resizeStateRef.current.lastX = e.clientX;
        resizeStateRef.current.lastY = e.clientY;

        // accumulate movement
        deltaAccumulatorXRef.current += deltaX;
        deltaAccumulatorYRef.current += deltaY;

        // horizontal snapping (unchanged)
        if (["e", "w", "ne", "nw", "se", "sw"].includes(dir)) {
          while (Math.abs(deltaAccumulatorXRef.current) >= localCellSize) {
            const step = Math.sign(deltaAccumulatorXRef.current);
            const px = step * localCellSize;
            onResize(itemPath, dir, px, 0, rect);
            deltaAccumulatorXRef.current -= step * localCellSize;
          }
        }

        // vertical snapping using engine rowHeight for proper conversion
        if (["n", "s", "ne", "nw", "se", "sw"].includes(dir)) {
          while (Math.abs(deltaAccumulatorYRef.current) >= localCellSize) {
            const step = Math.sign(deltaAccumulatorYRef.current);
            // compute pixel delta based on engine rowHeight so engine increments rows correctly
            const py = step * rowHeight;
            onResize(itemPath, dir, 0, py, rect);
            deltaAccumulatorYRef.current -= step * localCellSize;
          }
        }

        return; // skip drag logic during resizing
      }

      if (isDragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect(); // for getting values relative to container and cell size for snapping
        const localCellSize = rect.width / columnCount;

        const movementX =
          e.clientX -
          (dragStateRef.current.lastX ?? dragStateRef.current.startX);
        const movementY =
          e.clientY -
          (dragStateRef.current.lastY ?? dragStateRef.current.startY);
        dragStateRef.current.lastX = e.clientX;
        dragStateRef.current.lastY = e.clientY;

        dragAccumulatorXRef.current += movementX;
        dragAccumulatorYRef.current += movementY;

        // horizontal snap steps -abs(abosolute) values ensure it works in all directions
        while (Math.abs(dragAccumulatorXRef.current) >= localCellSize) {
          const step = Math.sign(dragAccumulatorXRef.current);
          const width =
            initialRectRef.current.colEnd - initialRectRef.current.colStart;
          const maxCol = columnCount - width;
          let newCol = initialRectRef.current.colStart + step;
          newCol = Math.max(0, Math.min(newCol, maxCol));
          onMove(itemPath, newCol, initialRectRef.current.rowStart);
          initialRectRef.current.colStart = newCol;
          dragAccumulatorXRef.current -= step * localCellSize;
        }

        // vertical snap steps
        while (Math.abs(dragAccumulatorYRef.current) >= localCellSize) {
          const step = Math.sign(dragAccumulatorYRef.current);
          const newRow = Math.max(0, initialRectRef.current.rowStart + step);
          onMove(itemPath, initialRectRef.current.colStart, newRow);
          initialRectRef.current.rowStart = newRow;
          dragAccumulatorYRef.current -= step * localCellSize;
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
    document.removeEventListener(
      "pointermove",
      handlePointerMove as EventListener,
    );
    document.removeEventListener("pointerup", handlePointerUp);
  };

  useEffect(() => {
    if (isResizing || isDragging) {
      document.addEventListener(
        "pointermove",
        handlePointerMove as EventListener,
      );
      document.addEventListener("pointerup", handlePointerUp);
      return () => {
        document.removeEventListener(
          "pointermove",
          handlePointerMove as EventListener,
        );
        document.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [
    isResizing,
    isDragging,
    itemPath,
    onResize,
    onMove,
    cellSize,
    containerRef,
  ]);

  const startResize = (dir: ResizeDirection) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    // snapshot initial rect to avoid initial jump
    initialRectRef.current = {
      colStart: item.colStart,
      colEnd: item.colEnd,
      rowStart: item.rowStart,
      rowEnd: item.rowEnd,
    };

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
    // Initialize drag operation: capture container rect,
    // compute local cell size, and store starting grid coordinates
    if (isResizing) return;
    onSelect(itemPath);
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localCellSize = rect.width / columnCount;
    const offsetX = e.clientX - (rect.left + item.colStart * localCellSize);
    const offsetY = e.clientY - (rect.top + item.rowStart * localCellSize);

    // snapshot initial rect and reset accumulators
    initialRectRef.current = {
      colStart: item.colStart,
      colEnd: item.colEnd,
      rowStart: item.rowStart,
      rowEnd: item.rowEnd,
    };
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

  // Calculate nested grid cell size
  const itemPixelWidth = width * cellSize;
  const nestedCellSize = itemPixelWidth / columnCount;

  // ref for this item's grid container (used for nested children)
  const nestedRef = useRef<HTMLDivElement>(null);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect(itemPath);
      }}
      onPointerDown={handleDragStart}
      style={{
        gridColumn: `${item.colStart + 1} / span ${width}`,
        gridRow: `${item.rowStart + 1} / span ${height}`,
      }}
      className={`relative border-2 rounded-lg p-4 transition-all touch-action-none overflow-hidden ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      } ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md z-20"
          : "border-gray-300 bg-white shadow-sm hover:shadow-md hover:border-gray-400"
      } ${isDragging ? "shadow-lg z-30" : "z-0"}`}
    >
      {/* Nested grid container: creates local grid context
          Cell size derived from parent width for visual scaling */}
      {depth < maxDepth && (
        <div
          ref={nestedRef}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
            gridAutoRows: `${nestedCellSize}px`,
            gap: "0",
            width: "100%",
            height: "calc(100% )",

            marginTop: "8px",
            position: "relative",
          }}
          className={`pointer-events-auto transition-colors ${
            isDragOver ? "bg-gray-300/60" : ""
          }`}
          onClick={(e) => {
            if (e.currentTarget !== e.target) return;
            e.stopPropagation();
            onSelect([]); // clear selection only when clicking background
          }}
          onDragOver={(e) => {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            setIsDragOver(false);
          }}
          onDrop={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsDragOver(false);

            const data = e.dataTransfer.getData("text/plain");
            if (data !== "palette-item") return;

            const rect = (
              e.currentTarget as HTMLDivElement
            ).getBoundingClientRect();
            onAddItem(e.clientX, e.clientY, rect, itemPath);
          }}
        >
          {/* Render nested children recursively using path-based identification */}
          {(item.children ?? []).map((child) => (
            <GridItem
              key={child.id}
              item={child}
              itemPath={[...itemPath, child.id]}
              selectedItemPath={selectedItemPath}
              onSelect={onSelect}
              onAddItem={onAddItem}
              onResize={onResize}
              onMove={onMove}
              onRemove={onRemove}
              containerRef={nestedRef}
              columnCount={columnCount}
              cellSize={nestedCellSize}
              rowHeight={rowHeight}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}

      {/* Item Label & Controls */}
      <div className="absolute inset-0 p-1 flex flex-col pointer-events-none">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">
            Item {item.id.slice(-3)}
          </span>
          <button
            onPointerDown={(e: React.PointerEvent) => {
              e.stopPropagation();
              e.preventDefault();
              try {
                containerRef.current?.releasePointerCapture?.(e.pointerId);
              } catch (_) {}
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture?.(
                  e.pointerId,
                );
              } catch (_) {}
              onRemove(itemPath);
            }}
            className={`text-xs pointer-events-auto ${
              isSelected ? "text-red-600 block" : "hidden"
            }`}
          >
             <Icon path={mdiDelete} size={0.8} />
          </button>
        </div>
        {/* <div className="text-xs text-gray-500">
          <div>Col: {item.colStart + 1} - {item.colEnd}</div>
          <div>Row: {item.rowStart + 1} - {item.rowEnd}</div>
          <div>Size: {width}×{height}</div>
        </div>*/}
      </div>

      {/* Resize handles - only show if selected and depth < maxDepth */}
      {isSelected && depth < maxDepth && (
        <>
          {/* Corner handles */}
          <div
            onPointerDown={startResize("nw")}
            className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nwse-resize hover:bg-blue-600 pointer-events-auto touch-action-none"
            title="Resize NW"
          />
          <div
            onPointerDown={startResize("ne")}
            className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nesw-resize hover:bg-blue-600 pointer-events-auto touch-action-none"
            title="Resize NE"
          />
          <div
            onPointerDown={startResize("sw")}
            className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nesw-resize hover:bg-blue-600 pointer-events-auto touch-action-none"
            title="Resize SW"
          />
          <div
            onPointerDown={startResize("se")}
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-sm cursor-nwse-resize hover:bg-blue-600 pointer-events-auto touch-action-none"
            title="Resize SE"
          />

          {/* Edge handles */}
          <div
            onPointerDown={startResize("n")}
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-8 cursor-n-resize hover:bg-blue-500/20 pointer-events-auto touch-action-none"
            title="Resize N"
          />
          <div
            onPointerDown={startResize("s")}
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-8 cursor-s-resize hover:bg-blue-500/20 pointer-events-auto touch-action-none"
            title="Resize S"
          />
          <div
            onPointerDown={startResize("w")}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 cursor-w-resize hover:bg-blue-500/20 pointer-events-auto touch-action-none"
            title="Resize W"
          />
          <div
            onPointerDown={startResize("e")}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 cursor-e-resize hover:bg-blue-500/20 pointer-events-auto touch-action-none"
            title="Resize E"
          />
        </>
      )}
    </div>
  );
}

export default GridItem;

/**
 * GridItem Component
 * ------------------
 * Represents a single grid item (supports deep nesting).
 *
 * Responsibilities:
 *
 * - Renders an item positioned using CSS Grid (colStart, colEnd, rowStart, rowEnd).
 * - Handles selection using path-based comparison.
 * - Supports drag-to-move with grid snapping.
 * - Supports resize (8-directional: n, s, e, w, ne, nw, se, sw).
 * - Uses RAF batching and movement accumulators for smooth snapping.
 * - Initializes nested grid when requested.
 * - Renders nested GridCanvas-like grid inside itself if children exist.
 * - Handles scoped drag-and-drop for adding child items.
 * - Prevents event bubbling issues between nested containers.
 *
 * This component handles UI interaction logic only.
 * Layout mutation and collision resolution are delegated to useGridEngine.
 */
