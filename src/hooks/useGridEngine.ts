'use client';

import { useState, useCallback, useEffect } from 'react';
import { GridItem } from '@/types/grid';

const DEFAULT_ITEM_WIDTH = 3; // columns
const DEFAULT_ITEM_HEIGHT = 3; // rows
const COLUMN_COUNT = 125;

// breakpoints used only to adjust row height
function getRowHeight(width: number): number {
  if (width > 1140) return 40;
  if (width > 768) return 36;
  if (width > 525) return 32;
  if (width > 375) return 28;
  if (width > 345) return 24;
  if (width > 320) return 20;
  return 16;
}

export type ResizeDirection =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export function useGridEngine() {
  const [layout, setLayout] = useState<GridItem[]>([]);
  const [rowHeight, setRowHeight] = useState<number>(40);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const columnCount = COLUMN_COUNT;

  // update rowHeight on resize
  useEffect(() => {
    const handleResize = () => {
      setRowHeight(getRowHeight(window.innerWidth));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // overlap detection
  const itemsOverlap = (a: GridItem, b: GridItem): boolean => {
    return (
      a.colStart < b.colEnd &&
      a.colEnd > b.colStart &&
      a.rowStart < b.rowEnd &&
      a.rowEnd > b.rowStart
    );
  };

  // Axis-aware collision resolvers

  // Resolve vertical collisions only for items that overlap in column span.
  const resolveVerticalResize = (
    changed: GridItem,
    currentLayout: GridItem[]
  ): GridItem[] => {
    const updated = currentLayout.map((i) => ({ ...i }));

    // only consider items that overlap in columns
    const candidates = updated.filter((i) => i.id !== changed.id && i.colStart < changed.colEnd && i.colEnd > changed.colStart);

    // Use a queue limited to column-overlapping candidates to preserve locality
    const queue: GridItem[] = [changed];

    while (queue.length) {
      const cur = queue.shift()!;

      for (const other of candidates) {
        if (other.id === cur.id) continue;
        if (itemsOverlap(cur, other)) {
          const h = other.rowEnd - other.rowStart;
          // push the other directly below cur
          if (other.rowStart < cur.rowEnd) {
            other.rowStart = cur.rowEnd;
            other.rowEnd = other.rowStart + h;
            // when we push this item, it may collide with other column-overlapping items
            queue.push(other);
          }
        }
      }
    }

    // replace originals in updated
    return updated.map((u) => {
      const found = candidates.find((c) => c.id === u.id);
      return found ? found : u;
    });
  };

  // Resolve horizontal expansion (east). Attempt to shift conflicting items right; wrap to next row if needed.
  // Return null if unable to resolve (blocked).
  const resolveHorizontalResize = (
    changed: GridItem,
    currentLayout: GridItem[]
  ): GridItem[] | null => {
    const updated = currentLayout.map((i) => ({ ...i }));

    // items that overlap in rows with the changed item (same row band)
    const rowCandidates = updated.filter((i) => i.id !== changed.id && i.rowStart < changed.rowEnd && i.rowEnd > changed.rowStart);

    // we'll attempt to shift items right deterministically using a queue
    const queue: GridItem[] = [changed];
    const maxIterations = 10000;
    let iter = 0;

    while (queue.length) {
      if (++iter > maxIterations) return null;
      const cur = queue.shift()!;

      for (const other of rowCandidates) {
        if (other.id === cur.id) continue;
        if (itemsOverlap(cur, other)) {
          const otherWidth = other.colEnd - other.colStart;
          const shift = cur.colEnd - other.colStart; // minimal shift to clear overlap
          let newColStart = other.colStart + Math.max(0, shift);

          // try to place to the right within bounds
          if (newColStart + otherWidth <= columnCount) {
            other.colStart = newColStart;
            other.colEnd = other.colStart + otherWidth;
            queue.push(other);
            continue;
          }

          // otherwise wrap to next row (place at col 0, row = cur.rowEnd)
          let targetRowStart = cur.rowEnd;
          const originalHeight = other.rowEnd - other.rowStart;
          other.colStart = 0;
          other.colEnd = other.colStart + otherWidth;
          other.rowStart = targetRowStart;
          other.rowEnd = other.rowStart + originalHeight;

          // After wrapping, we must ensure no overlap vertically in its column span; use vertical resolver for it
          const temp = resolveVerticalResize(other, updated);
          // merge temp results into updated
          for (const t of temp) {
            const idx = updated.findIndex((u) => u.id === t.id);
            if (idx >= 0) updated[idx] = { ...t };
          }

          // continue processing as this moved item may cause more horizontal shifts within its row band later
          queue.push(other);
        }
      }
    }

    return updated;
  };

  // Resolve drag: moving an item to a new position should push down only column-overlapping items
  const resolveDrag = (moved: GridItem, currentLayout: GridItem[]): GridItem[] => {
    const updated = currentLayout.map((i) => ({ ...i }));
    // find column-overlapping items
    const candidates = updated.filter((i) => i.id !== moved.id && i.colStart < moved.colEnd && i.colEnd > moved.colStart);

    const queue: GridItem[] = [moved];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const other of candidates) {
        if (other.id === cur.id) continue;
        if (itemsOverlap(cur, other)) {
          const h = other.rowEnd - other.rowStart;
          other.rowStart = cur.rowEnd;
          other.rowEnd = other.rowStart + h;
          queue.push(other);
        }
      }
    }

    // merge affected candidates back
    return updated.map((u) => {
      const found = candidates.find((c) => c.id === u.id);
      return found ? found : u;
    });
  };

  // convert pixels to grid coords (colStart, rowStart)
  const pixelToGrid = (
    pixelX: number,
    pixelY: number,
    containerRect: DOMRect
  ): { colStart: number; rowStart: number } => {
    const relativeX = pixelX - containerRect.left;
    const relativeY = pixelY - containerRect.top;

    const colWidth = containerRect.width / columnCount;
    const colStart = Math.floor(Math.max(0, Math.min(relativeX, containerRect.width - 1) / colWidth));
    const rowStart = Math.floor(Math.max(0, relativeY / rowHeight));

    return { colStart, rowStart };
  };

  // add new item from palette drop
  const addItem = useCallback(
    (pixelX: number, pixelY: number, containerRect: DOMRect) => {
      const { colStart, rowStart } = pixelToGrid(pixelX, pixelY, containerRect);
      const colEnd = Math.min(colStart + DEFAULT_ITEM_WIDTH, columnCount);
      const rowEnd = rowStart + DEFAULT_ITEM_HEIGHT;

      const newItem: GridItem = {
        id: `item-${Date.now()}`,
        colStart,
        colEnd,
        rowStart,
        rowEnd,
      };

      setLayout((current) => {
        // place and push down only items that share columns
        return resolveVerticalResize(newItem, [...current, newItem]);
      });
    },
    [columnCount, rowHeight]
  );

  // move an existing item
  const moveItem = useCallback(
    (itemId: string, newColStart: number, newRowStart: number) => {
      setLayout((current) => {
        const item = current.find((i) => i.id === itemId);
        if (!item) return current;

        const width = item.colEnd - item.colStart;
        const height = item.rowEnd - item.rowStart;

        // clamp horizontal position
        newColStart = Math.max(0, Math.min(newColStart, columnCount - width));
        // row start may be any non-negative
        newRowStart = Math.max(0, newRowStart);

        const moved: GridItem = {
          ...item,
          colStart: newColStart,
          colEnd: newColStart + width,
          rowStart: newRowStart,
          rowEnd: newRowStart + height,
        };

        const updated = current.map((i) => (i.id === itemId ? moved : { ...i }));
        return resolveDrag(moved, updated);
      });
    },
    [columnCount]
  );

  // resize existing item with direction (transactional, axis-aware)
  const resizeItem = useCallback(
    (
      itemId: string,
      direction: ResizeDirection,
      deltaX: number,
      deltaY: number,
      containerRect: DOMRect
    ) => {
      setLayout((current) => {
        const item = current.find((i) => i.id === itemId);
        if (!item) return current;

        const colWidth = containerRect.width / columnCount;
        const colDelta = Math.round(deltaX / colWidth);
        const rowDelta = Math.round(deltaY / rowHeight);

        let { colStart, colEnd, rowStart, rowEnd } = item;

        const width = colEnd - colStart;
        const height = rowEnd - rowStart;

        // compute tentative changes
        switch (direction) {
          case 'e':
            colEnd = Math.min(colEnd + colDelta, columnCount);
            break;
          case 'w':
            colStart = Math.max(0, colStart + colDelta);
            break;
          case 's':
            rowEnd = Math.max(rowStart + 1, rowEnd + rowDelta);
            break;
          case 'n':
            rowStart = Math.max(0, rowStart + rowDelta);
            break;
          case 'ne':
            colEnd = Math.min(colEnd + colDelta, columnCount);
            rowStart = Math.max(0, rowStart + rowDelta);
            break;
          case 'nw':
            colStart = Math.max(0, colStart + colDelta);
            rowStart = Math.max(0, rowStart + rowDelta);
            break;
          case 'se':
            colEnd = Math.min(colEnd + colDelta, columnCount);
            rowEnd = Math.max(rowStart + 1, rowEnd + rowDelta);
            break;
          case 'sw':
            colStart = Math.max(0, colStart + colDelta);
            rowEnd = Math.max(rowStart + 1, rowEnd + rowDelta);
            break;
        }

        if (colEnd <= colStart) colEnd = colStart + 1;
        if (rowEnd <= rowStart) rowEnd = rowStart + 1;

        const resized: GridItem = { ...item, colStart, colEnd, rowStart, rowEnd };

        // baseline layout with resized item applied
        const baseline = current.map((c) => (c.id === itemId ? resized : { ...c }));

        // If horizontal component exists, attempt horizontal resolution first
        if (direction.includes('e') || direction === 'w' || direction === 'ne' || direction === 'nw' || direction === 'se' || direction === 'sw') {
          const horiz = resolveHorizontalResize(resized, baseline);
          if (horiz === null) {
            // try wrap-to-next-row strategy
            const wrapped = { ...resized };
            const newW = wrapped.colEnd - wrapped.colStart;
            wrapped.colStart = 0;
            wrapped.colEnd = newW;
            wrapped.rowStart = item.rowEnd;
            wrapped.rowEnd = wrapped.rowStart + height;
            const v = resolveVerticalResize(wrapped, baseline.map((c) => (c.id === itemId ? wrapped : c)));
            return v;
          }
          // if vertical component also exists (diagonal), apply vertical resolver on top
          if (direction.includes('n') || direction.includes('s')) {
            const updatedItem = horiz.find((h) => h.id === itemId) || resized;
            return resolveVerticalResize(updatedItem, horiz);
          }
          return horiz;
        }

        // pure vertical resize
        return resolveVerticalResize(resized, baseline);
      });
    },
    [columnCount, rowHeight]
  );

  // ensure no item exceeds column count after any operation
  const reflow = useCallback(() => {
    setLayout((current) => {
      return current.map((item) => {
        let { colStart, colEnd } = item;
        if (colStart >= columnCount) {
          colStart = 0;
          colEnd = columnCount;
        }
        if (colEnd > columnCount) {
          colEnd = columnCount;
        }
        return { ...item, colStart, colEnd };
      });
    });
  }, []);

  // expose utilities
  const removeItem = useCallback((itemId: string) => {
    setLayout((current) => current.filter((i) => i.id !== itemId));
    setSelectedItemId((curr) => (curr === itemId ? null : curr));
  }, []);

  const selectItem = useCallback((itemId: string | null) => {
    setSelectedItemId(itemId);
  }, []);

  return {
    layout,
    columnCount,
    rowHeight,
    selectedItemId,
    addItem,
    moveItem,
    resizeItem,
    removeItem,
    pixelToGrid,
    selectItem,
  };
}
