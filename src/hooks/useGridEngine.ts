'use client';

import { useState, useCallback, useEffect } from 'react';
import { GridItem } from '@/types/grid';

const DEFAULT_ITEM_WIDTH = 1; // columns
const DEFAULT_ITEM_HEIGHT = 1; // rows
const COLUMN_COUNT = 125;
const MAX_NESTING_DEPTH = 10;

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

// ============================================================================
// Tree Navigation Helpers (for nested grid support)
// ============================================================================

/**
 * Find an item by path (array of IDs from root to target)
 */
function findItemByPath(layout: GridItem[], path: string[]): GridItem | null {
  if (path.length === 0) return null;
  
  let current: GridItem | null = null;
  for (let i = 0; i < path.length; i++) {
    const id = path[i];
    if (i === 0) {
      current = layout.find((item) => item.id === id) || null;
    } else {
      current = (current?.children || []).find((item) => item.id === id) || null;
    }
    if (!current) return null;
  }
  
  return current;
}

/**
 * Find container (parent's children array) and the item at given path
 */
function findContainerAtPath(
  layout: GridItem[],
  path: string[]
): { container: GridItem[] | null; item: GridItem | null; parentItem: GridItem | null } {
  if (path.length === 0) {
    return { container: null, item: null, parentItem: null };
  }

  const itemId = path[path.length - 1];
  const parentPath = path.slice(0, -1);

  if (parentPath.length === 0) {
    // Item is at root level
    const item = layout.find((i) => i.id === itemId) || null;
    return { container: layout, item, parentItem: null };
  }

  // Find parent
  const parentItem = findItemByPath(layout, parentPath);
  if (!parentItem) {
    return { container: null, item: null, parentItem: null };
  }

  const container = parentItem.children || null;
  const item = container ? container.find((i) => i.id === itemId) || null : null;

  return { container, item, parentItem };
}

/**
 * Update an item at a given path, returning new layout
 */
function updateItemAtPath(
  layout: GridItem[],
  path: string[],
  updater: (item: GridItem) => GridItem
): GridItem[] {
  if (path.length === 0) return layout;

  const itemId = path[0];
  const restPath = path.slice(1);

  return layout.map((item) => {
    if (item.id !== itemId) return item;

    if (restPath.length === 0) {
      return updater(item);
    }

    return {
      ...item,
      children: item.children ? updateItemAtPath(item.children, restPath, updater) : [],
    };
  });
}

/**
 * Recursively delete an item (and all descendants) at a path
 */
function deleteAtPath(layout: GridItem[], path: string[]): GridItem[] {
  if (path.length === 0) return layout;

  const itemId = path[0];
  const restPath = path.slice(1);

  if (restPath.length === 0) {
    // Delete at this level
    return layout.filter((i) => i.id !== itemId);
  }

  // Recurse into children
  return layout.map((item) => {
    if (item.id !== itemId) return item;
    return {
      ...item,
      children: item.children ? deleteAtPath(item.children, restPath) : undefined,
    };
  });
}

export function useGridEngine() {
  const [layout, setLayout] = useState<GridItem[]>([]);
  const [rowHeight, setRowHeight] = useState<number>(10);
  const [selectedItemPath, setSelectedItemPath] = useState<string[]>([]);

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

  /**
   * Resolve collisions within a specific container (scoped collision detection)
   */
  const resolveCollisionsInContainer = (
    container: GridItem[],
    movedItemId: string,
    direction?: ResizeDirection
  ): GridItem[] => {
    const updated = container.map((i) => ({ ...i }));
    const movedItem = updated.find((i) => i.id === movedItemId);
    if (!movedItem) return updated;

    // Determine which resolver to use based on direction
    if (direction && (direction.includes('e') || direction.includes('w'))) {
      const horiz = resolveHorizontalResizeInContainer(movedItem, updated);
      if (horiz === null) {
        // Fallback: wrap and resolve vertically
        const wrapped = { ...movedItem };
        const newW = wrapped.colEnd - wrapped.colStart;
        wrapped.colStart = 0;
        wrapped.colEnd = newW;
        wrapped.rowStart = movedItem.rowEnd;
        wrapped.rowEnd = wrapped.rowStart + (movedItem.rowEnd - movedItem.rowStart);
        const baseline = updated.map((c) => (c.id === movedItemId ? wrapped : c));
        return resolveVerticalResizeInContainer(wrapped, baseline);
      }

      if (direction.includes('n') || direction.includes('s')) {
        const updatedItem = horiz.find((h) => h.id === movedItemId) || movedItem;
        return resolveVerticalResizeInContainer(updatedItem, horiz);
      }
      return horiz;
    }

    // Default: vertical resolve
    return resolveVerticalResizeInContainer(movedItem, updated);
  };

  // Resolve vertical collisions only for items that overlap in column span.
  const resolveVerticalResizeInContainer = (
    changed: GridItem,
    currentContainer: GridItem[]
  ): GridItem[] => {
    const updated = currentContainer.map((i) => ({ ...i }));

    // only consider items that overlap in columns
    const candidates = updated.filter(
      (i) => i.id !== changed.id && i.colStart < changed.colEnd && i.colEnd > changed.colStart
    );

    const queue: GridItem[] = [changed];

    while (queue.length) {
      const cur = queue.shift()!;

      for (const other of candidates) {
        if (other.id === cur.id) continue;
        if (itemsOverlap(cur, other)) {
          const h = other.rowEnd - other.rowStart;
          if (other.rowStart < cur.rowEnd) {
            other.rowStart = cur.rowEnd;
            other.rowEnd = other.rowStart + h;
            queue.push(other);
          }
        }
      }
    }

    return updated.map((u) => {
      const found = candidates.find((c) => c.id === u.id);
      return found ? found : u;
    });
  };

  // Resolve horizontal expansion (east). Attempt to shift conflicting items right; wrap to next row if needed.
  const resolveHorizontalResizeInContainer = (
    changed: GridItem,
    currentContainer: GridItem[]
  ): GridItem[] | null => {
    const updated = currentContainer.map((i) => ({ ...i }));

    // items that overlap in rows with the changed item (same row band)
    const rowCandidates = updated.filter(
      (i) => i.id !== changed.id && i.rowStart < changed.rowEnd && i.rowEnd > changed.rowStart
    );

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
          const shift = cur.colEnd - other.colStart;
          let newColStart = other.colStart + Math.max(0, shift);

          if (newColStart + otherWidth <= columnCount) {
            other.colStart = newColStart;
            other.colEnd = other.colStart + otherWidth;
            queue.push(other);
            continue;
          }

          // otherwise wrap to next row
          let targetRowStart = cur.rowEnd;
          const originalHeight = other.rowEnd - other.rowStart;
          other.colStart = 0;
          other.colEnd = other.colStart + otherWidth;
          other.rowStart = targetRowStart;
          other.rowEnd = other.rowStart + originalHeight;

          const temp = resolveVerticalResizeInContainer(other, updated);
          for (const t of temp) {
            const idx = updated.findIndex((u) => u.id === t.id);
            if (idx >= 0) updated[idx] = { ...t };
          }

          queue.push(other);
        }
      }
    }

    return updated;
  };

  // Resolve drag: moving an item to a new position should push down only column-overlapping items
  const resolveDragInContainer = (
    moved: GridItem,
    currentContainer: GridItem[]
  ): GridItem[] => {
    const updated = currentContainer.map((i) => ({ ...i }));
    const candidates = updated.filter(
      (i) => i.id !== moved.id && i.colStart < moved.colEnd && i.colEnd > moved.colStart
    );

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

    return updated.map((u) => {
      const found = candidates.find((c) => c.id === u.id);
      return found ? found : u;
    });
  };

  // Axis-aware collision resolvers (OLD, for backward compat if needed)

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


//check all the overlapping items here      
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

    // replace originals in updated - only affected candidates are changed and updated
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

          // continue processing as this moved item may cause more horizontal shifts within
          //  its row band later
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

  // add new item from palette drop with path support
  const addItem = useCallback(
    (pixelX: number, pixelY: number, containerRect: DOMRect, targetPath: string[] = []) => {
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
        if (targetPath.length === 0) {
          // Add to root level
          const result = resolveVerticalResize(newItem, [...current, newItem]);
          return result;
        }

        // Add to nested container at the exact path
        return updateItemAtPath(current, targetPath, (parent) => {
          const container = parent.children || [];
          const resolved = resolveVerticalResizeInContainer(newItem, [...container, newItem]);
          return { ...parent, children: resolved };
        });
      });
    },
    [columnCount, rowHeight]
  );

  // move an existing item with path support
  const moveItem = useCallback(
    (itemPath: string[], newColStart: number, newRowStart: number) => {
      setLayout((current) => {
        const { container, item } = findContainerAtPath(current, itemPath);
        if (!container || !item) return current;

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

        const updated = container.map((i) => (i.id === itemPath[itemPath.length - 1] ? moved : { ...i }));
        const resolved = resolveDragInContainer(moved, updated);

        // Update at container level
        if (itemPath.length === 1) {
          return resolved;
        }

        return updateItemAtPath(current, itemPath.slice(0, -1), (parent) => ({
          ...parent,
          children: resolved,
        }));
      });
    },
    [columnCount]
  );

  // resize existing item with direction (transactional, axis-aware, path-based)
  const resizeItem = useCallback(
    (
      itemPath: string[],
      direction: ResizeDirection,
      deltaX: number,
      deltaY: number,
      containerRect: DOMRect
    ) => {
      setLayout((current) => {
        const { container, item } = findContainerAtPath(current, itemPath);
        if (!container || !item) return current;

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
        const updated = container.map((c) => (c.id === itemPath[itemPath.length - 1] ? resized : { ...c }));

        // Resolve collisions in container with direction awareness
        const resolved = resolveCollisionsInContainer(updated, itemPath[itemPath.length - 1], direction);

        // Update at container level
        if (itemPath.length === 1) {
          return resolved;
        }

        return updateItemAtPath(current, itemPath.slice(0, -1), (parent) => ({
          ...parent,
          children: resolved,
        }));
      });
    },
    [columnCount, rowHeight]
  );

  // ensure no item exceeds column count after any operation
  const reflow = useCallback(() => {
    setLayout((current) => {
      const reflowContainer = (container: GridItem[]): GridItem[] => {
        return container.map((item) => {
          let { colStart, colEnd } = item;
          if (colStart >= columnCount) {
            colStart = 0;
            colEnd = columnCount;
          }
          if (colEnd > columnCount) {
            colEnd = columnCount;
          }
          const result = { ...item, colStart, colEnd };
          if (result.children) {
            result.children = reflowContainer(result.children);
          }
          return result;
        });
      };
      return reflowContainer(current);
    });
  }, []);

  // expose utilities
  const removeItem = useCallback((itemPath: string[]) => {
    setLayout((current) => deleteAtPath(current, itemPath));
    // Clear selection if removed item was selected
    if (itemPath.length > 0) {
      setSelectedItemPath((curr) => {
        if (curr.length === itemPath.length && curr.every((id, i) => id === itemPath[i])) {
          return [];
        }
        return curr;
      });
    }
  }, []);

  const selectItem = useCallback((path: string[] | null) => {
    setSelectedItemPath(path || []);
  }, []);

  // Initialize children grid for nested containers
  const initializeChildrenGrid = useCallback((itemPath: string[]) => {
    setLayout((current) => {
      return updateItemAtPath(current, itemPath, (item) => ({
        ...item,
        children: [],
      }));
    });
  }, []);

  // Get selected item from path
  const getSelectedItem = useCallback((): GridItem | null => {
    if (selectedItemPath.length === 0) return null;
    return findItemByPath(layout, selectedItemPath);
  }, [layout, selectedItemPath]);

  return {
    layout,
    columnCount,
    rowHeight,
    selectedItemPath,
    selectedItem: getSelectedItem(),
    addItem,
    moveItem,
    resizeItem,
    removeItem,
    pixelToGrid,
    selectItem,
    initializeChildrenGrid,
  };
}
