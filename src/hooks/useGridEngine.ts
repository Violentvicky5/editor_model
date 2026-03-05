'use client';

import { useState, useCallback, useEffect } from 'react';
import { GridItem } from '@/types/grid';

const DEFAULT_ITEM_WIDTH = 10; // columns
const DEFAULT_ITEM_HEIGHT = 10; // rows
const COLUMN_COUNT = 125;


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
function findItemByPath(
  layout: GridItem[],
  path: string[]
): GridItem | null {
  if (!path.length) return null;

  let current = layout.find((item) => item.id === path[0]);

  for (let i = 1; i < path.length && current; i++) {
    current = current.children?.find(
      (item) => item.id === path[i]
    );
  }

  return current ?? null;
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

// Recursively traverses layout tree using path array
// Clones only the affected branch to maintain immutability
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

// ============================================================================
// Mobile Layout Transformer (derive mobile layout from desktop)
// ============================================================================

/**
 * Transform desktop layout to mobile layout (vertical stack)
 * - Sorts items by rowStart ASC, then colStart ASC
 * - Ignores: colStart, colEnd, rowStart, rowEnd (grid positioning irrelevant)
 * - Recursively transforms nested children
 * - Preserves full hierarchy (no flattening)
 * Returns new layout suitable for flex column rendering
 */
function transformToMobile(layout: GridItem[]): GridItem[] {
  // Sort items by rowStart, then colStart for deterministic vertical stacking
  const sorted = [...layout].sort((a, b) => {
    if (a.rowStart !== b.rowStart) return a.rowStart - b.rowStart;
    return a.colStart - b.colStart;
  });

  // Transform each item: keep id and children, ignore grid positioning
  return sorted.map((item) => ({
    id: item.id,
    colStart: 0, // reset positioning (irrelevant in mobile)
    colEnd: 1,
    rowStart: 0,
    rowEnd: 1,
    children: item.children ? transformToMobile(item.children) : undefined,
  }));
}

/**
 * Helper: find and reorder item within a container by index
 */
function reorderItemInContainer(
  container: GridItem[],
  fromIndex: number,
  toIndex: number
): GridItem[] {
  if (fromIndex < 0 || fromIndex >= container.length) return container;
  if (toIndex < 0 || toIndex >= container.length) return container;
  if (fromIndex === toIndex) return container;

  const reordered = [...container];
  const [item] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, item);
  return reordered;
}

/**
 * Update mobile layout at a given path by reordering items
 */
function reorderMobileItemAtPath(
  layout: GridItem[],
  path: string[],
  fromIndex: number,
  toIndex: number
): GridItem[] {
  if (path.length === 0) {
    // Reorder at root level
    return reorderItemInContainer(layout, fromIndex, toIndex);
  }

  const itemId = path[0];
  const restPath = path.slice(1);

  return layout.map((item) => {
    if (item.id !== itemId) return item;

    if (restPath.length === 0) {
      // Found the container, reorder its children
      const reordered = reorderItemInContainer(
        item.children || [],
        fromIndex,
        toIndex
      );
      return { ...item, children: reordered };
    }

    // Recurse deeper
    return {
      ...item,
      children: item.children
        ? reorderMobileItemAtPath(item.children, restPath, fromIndex, toIndex)
        : undefined,
    };
  });
}

// ============================================================================
// Mobile Layout Merge Strategy (for hybrid sync)
// ============================================================================

/**
 * Intelligently merge desktop changes into mobile while preserving custom order
 * 
 * Rules:
 * - Keep existing mobile items in their current order
 * - Add new items from desktop that don't exist in mobile
 * - Remove items that were deleted in desktop
 * - Update nested structures recursively
 * - Match items by IDs only
 */
function mergeDesktopIntoMobile(
  desktopLayout: GridItem[],
  mobileLayout: GridItem[]
): GridItem[] {
  // Build map of desktop items by ID for quick lookup
  const desktopMap = new Map<string, GridItem>();
  
  const collectDesktopItems = (items: GridItem[]) => {
    items.forEach((item) => {
      desktopMap.set(item.id, item);
      if (item.children) {
        collectDesktopItems(item.children);
      }
    });
  };
  
  collectDesktopItems(desktopLayout);

  // Keep existing mobile items in their current order
  // Remove if deleted from desktop, update children if they exist
  const retained = mobileLayout
    .map((mobileItem) => {
      const desktopItem = desktopMap.get(mobileItem.id);
      
      if (!desktopItem) {
        // Item was deleted in desktop, remove from mobile
        return null;
      }
      
      // Item exists in desktop - sync children recursively
      const synced: GridItem = {
        id: mobileItem.id,
        colStart: 0,
        colEnd: 1,
        rowStart: 0,
        rowEnd: 1,
        children: mobileItem.children && desktopItem.children
          ? mergeDesktopIntoMobile(desktopItem.children, mobileItem.children)
          : desktopItem.children
            ? transformToMobile(desktopItem.children)
            : undefined,
      };
      
      return synced;
    })
    .filter((item): item is GridItem => item !== null);

  // Add new items from desktop that don't exist in mobile
  const mobileIds = new Set(mobileLayout.map((item) => item.id));
  const newItems = desktopLayout
    .filter((item) => !mobileIds.has(item.id))
    .map((item) => ({
      id: item.id,
      colStart: 0,
      colEnd: 1,
      rowStart: 0,
      rowEnd: 1,
      children: item.children ? transformToMobile(item.children) : undefined,
    }));

  return [...retained, ...newItems];
}

export function useGridEngine(initialColumnCount: number = COLUMN_COUNT) {
  const [layout, setLayout] = useState<GridItem[]>([]);
  const [mobileLayout, setMobileLayout] = useState<GridItem[] | null>(null);
  const [hasMobileCustomOrder, setHasMobileCustomOrder] = useState<boolean>(false);
  const [rowHeight, setRowHeight] = useState<number>(10);
  const [selectedItemPath, setSelectedItemPath] = useState<string[]>([]);

  const columnCount = initialColumnCount;

 
  // overlap detection
  const itemsOverlap = (a: GridItem, b: GridItem): boolean => {
    return (
      a.colStart < b.colEnd &&
      a.colEnd > b.colStart &&
      a.rowStart < b.rowEnd &&
      a.rowEnd > b.rowStart
    );
  };

  // Ensures items within the same container do not overlap
  // Scoped to siblings only (container-based collision)
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



// Default south behavior
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

const maxIterations = 300;
let iteration = 0;

while (queue.length) {
  if (++iteration > maxIterations) {
    console.warn("Vertical resolve aborted ");
    break;
  }

  const cur = queue.shift()!;

  for (const other of candidates) {
    if (other.id === cur.id) continue;

    if (itemsOverlap(cur, other)) {
      const height = other.rowEnd - other.rowStart;

      const newRowStart = cur.rowEnd;
      const newRowEnd = newRowStart + height;

      // Only update if position actually changes
      if (
        other.rowStart !== newRowStart ||
        other.rowEnd !== newRowEnd
      ) {
        other.rowStart = newRowStart;
        other.rowEnd = newRowEnd;

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
    const maxIterations = 500;
let iter = 0;
    

    while (queue.length) {
     if (++iter > maxIterations) {
    console.warn("Collision resolve aborted");
    break;
  }
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

const maxIterations = 300;
let iteration = 0;

while (queue.length) {
  if (++iteration > maxIterations) {
    console.warn("Drag collision resolve aborted ");
    break;
  }

  const cur = queue.shift()!;

  for (const other of candidates) {
    if (other.id === cur.id) continue;

    if (itemsOverlap(cur, other)) {
      const height = other.rowEnd - other.rowStart;

      const newRowStart = cur.rowEnd;
      const newRowEnd = newRowStart + height;

      // Only update if position actually changes
      if (
        other.rowStart !== newRowStart ||
        other.rowEnd !== newRowEnd
      ) {
        other.rowStart = newRowStart;
        other.rowEnd = newRowEnd;
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
   // Use a queue limited to column-overlapping candidates to preserve locality
const queue: GridItem[] = [changed];

const maxIterations = 300;
let iteration = 0;

while (queue.length) {
  if (++iteration > maxIterations) {
    console.warn("Vertical resize resolve aborted ");
    break;
  }

  const cur = queue.shift()!;

  // check all overlapping items
  for (const other of candidates) {
    if (other.id === cur.id) continue;

    if (itemsOverlap(cur, other)) {
      const height = other.rowEnd - other.rowStart;

      const newRowStart = cur.rowEnd;
      const newRowEnd = newRowStart + height;

      // Only update if position actually changes
      if (
        other.rowStart !== newRowStart ||
        other.rowEnd !== newRowEnd
      ) {
        other.rowStart = newRowStart;
        other.rowEnd = newRowEnd;

        // This pushed item may now collide with others
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
  const existingChildren = parent.children ?? [];

  const updatedChildren = [...existingChildren, newItem];
  const resolved = resolveVerticalResizeInContainer(newItem, updatedChildren);

  return {
    ...parent,
    children: resolved,
  };
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
  

  // Get selected item from path
  const getSelectedItem = useCallback((): GridItem | null => {
    if (selectedItemPath.length === 0) return null;
    return findItemByPath(layout, selectedItemPath);
  }, [layout, selectedItemPath]);

  // Initialize mobile layout from current desktop layout
  // Called when user switches to mobile view for the first time
  const initMobileLayout = useCallback(() => {
    if (mobileLayout === null) {
      const transformed = transformToMobile(layout);
      setMobileLayout(transformed);
      setHasMobileCustomOrder(false);
    }
  }, [layout, mobileLayout]);

  // Reorder item in mobile layout only (independent from desktop)
  // path: array of IDs to navigate to container level
  // fromIndex, toIndex: indices within that container
  const reorderMobileItem = useCallback(
    (path: string[], fromIndex: number, toIndex: number) => {
      setMobileLayout((current) => {
        if (current === null) return null;
        return reorderMobileItemAtPath(current, path, fromIndex, toIndex);
      });
      setHasMobileCustomOrder(true);
    },
    []
  );

  // Sync mobile layout when desktop layout changes
  // Strategy:
  // - If mobileLayout is null, do nothing (mobile not initialized yet)
  // - If hasMobileCustomOrder is false, re-transform entire mobile from desktop
  // - If hasMobileCustomOrder is true, intelligently merge desktop changes
  useEffect(() => {
    if (mobileLayout === null) {
      // Mobile not initialized, no sync needed
      return;
    }

    if (!hasMobileCustomOrder) {
      // Mobile is clean (no custom reorder), re-transform from desktop
      const transformed = transformToMobile(layout);
      setMobileLayout(transformed);
    } else {
      // Mobile has custom order, merge smartly to preserve it
      const merged = mergeDesktopIntoMobile(layout, mobileLayout);
      setMobileLayout(merged);
    }
  }, [layout, hasMobileCustomOrder]); // Removed mobileLayout to prevent infinite loop

  return {
    layout,
    mobileLayout,
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
    initMobileLayout,
    reorderMobileItem,
  };
}
/**
 * useGridEngine Hook
 * ------------------
 * Core layout engine for the nested grid system.
 *
 * Responsibilities:
 *
 * - Maintains full layout tree state.
 * - Maintains selected item path.
 * - Converts pixel coordinates to grid positions.
 * - Adds new items (root or nested).
 * - Moves items with collision resolution.
 * - Resizes items with axis-aware collision handling.
 * - Resolves vertical and horizontal overlaps deterministically.
 * - Supports nested containers using path-based tree navigation.
 * - Handles item deletion recursively.
 * - Ensures grid bounds and reflow constraints.
 *
 * Includes:
 * - Tree navigation helpers (findItemByPath, updateItemAtPath, deleteAtPath).
 * - Container-scoped collision resolution.
 * - Axis-aware resizing logic.
 * - Drag resolution logic.
 *
 * This hook contains all business logic and layout mutation rules.
 * UI components remain stateless and delegate actions here.
 */