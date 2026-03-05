# Grid Editor - Responsive Layout System

## Project Overview

This is a advanced grid-based layout editor with responsive mobile projection. The system provides two parallel rendering modes:

1. **Desktop Mode**: A full-featured 125-column grid layout system with collision detection, resize support, and nested grid containers.
2. **Mobile Mode**: A projection-based responsive view that derives a stacked vertical layout from the desktop layout, with independent reorder capability.

### Core Architecture Philosophy

The system uses a **hybrid sync strategy** with desktop as single source of truth:

- **Desktop layout** is the primary layout state, maintained in `useGridEngine`
- **Mobile layout** is derived from desktop layout via transformation on first mobile view
- **Automatic sync**: Mobile layout automatically updates when desktop changes
- **Smart merge**: If mobile has custom reorder, new desktop items are added without destroying order
- **Independent reorder**: Mobile can be reordered without affecting desktop layout
- **Desktop layout is never mutated** by mobile operations
- Both layouts share the same item structure but use different positioning systems

### Key Capabilities

**Desktop**:
- 125-column grid with dynamic row calculation
- Full collision detection system
- 8-direction resize support (n, s, e, w, ne, nw, se, sw)
- Horizontal and vertical drag support
- Nested grid containers with recursive collision handling
- Path-based item identification for deep nesting

**Mobile**:
- Automatic vertical stacking (flex column)
- Full-width items with content-based height
- Vertical reorder only (no horizontal movement or resizing)
- Independent mobile layout state
- Nested container support with proper visual separation
- Smooth vertical scrolling within phone preview frame

---

## Folder Structure

```
editor_model/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main application page
│   │   ├── layout.tsx            # RootLayout wrapper
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   ├── GridCanvas.tsx        # Desktop grid container (CSS Grid)
│   │   ├── GridItem.tsx          # Desktop grid item (resizable, draggable)
│   │   ├── MobileGridCanvas.tsx  # Mobile flex container
│   │   ├── MobileGridItem.tsx    # Mobile flex item (draggable vertical)
│   │   ├── Palette.tsx           # Item palette for adding new items
│   │   └── Sidebar.tsx           # Properties panel for selected item
│   ├── hooks/
│   │   └── useGridEngine.ts      # Core state and logic engine
│   ├── types/
│   │   └── grid.ts              # TypeScript type definitions
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── postcss.config.mjs
└── README.md
```

### Folder Purpose

- **src/app/**: Next.js app router entry points
- **src/components/**: React UI components (grid, items, mobile, palette, sidebar)
- **src/hooks/**: Custom React hooks (state management, layout logic)
- **src/types/**: TypeScript interfaces and types

---

## Core Architecture

### useGridEngine Hook - State Management

`useGridEngine` is the single state manager for layout operations. It maintains:

1. **layout**: GridItem[] - Desktop layout tree (source of truth)
2. **mobileLayout**: GridItem[] | null - Mobile projection (auto-syncs with desktop)
3. **hasMobileCustomOrder**: boolean - Tracks if mobile has been manually reordered
4. **rowHeight**: number - Default row height (10px)
5. **selectedItemPath**: string[] - Current selection path (e.g., ["item-1", "item-2"])
6. **columnCount**: number - Grid column count (125 for desktop)

### Why Hybrid Sync Strategy?

- **Desktop layout** is the editing source; users manipulate grid coordinates directly
- **Mobile layout** auto-syncs from desktop to stay current with changes
- **Smart merge** preserves mobile custom order when desktop items are added/removed
- **Lazy initialization** (mobileLayout is null initially) optimizes for desktop-first usage
- **Independent reorder** allows mobile customization without affecting desktop
- **Never stale** mobile layout automatically reflects desktop changes

---

## Key Functions in useGridEngine

### transformToMobile(layout: GridItem[]): GridItem[]

Core mobile projection function that:
1. Sorts items by rowStart ASC, then colStart ASC (reading order)
2. Resets grid coords (colStart=0, colEnd=1, rowStart=0, rowEnd=0)
3. Recursively transforms children while preserving hierarchy
4. Returns mobile-ready layout with no flattening

### mergeDesktopIntoMobile(desktopLayout, mobileLayout): GridItem[]

Intelligent merge function for hybrid sync that:
1. Preserves existing mobile custom order
2. Adds new desktop items not in mobile
3. Removes items deleted from desktop
4. Updates nested structures recursively
5. Matches items by ID only (never by index)
6. Maintains mobile reorder positions for existing items

### Collision Detection (Desktop)

**resolveVerticalResizeInContainer**: Pushes items down cascade on height increase

**resolveHorizontalResizeInContainer**: Shifts right or wraps to next row on width increase

**resolveDragInContainer**: Pushes items down only, maintains horizontal arrangement

### Desktop Operations

- **addItem**: Creates item at drop position, resolves collisions
- **moveItem**: Moves item to new grid position, cascades overlapping items downward
- **resizeItem**: Updates dimensions in direction (n/s/e/w), resolves direction-aware collisions
- **removeItem**: Deletes item and descendants, clears selection if needed

### Mobile Operations

- **initMobileLayout()**: One-time transformation from desktop to mobile, sets `hasMobileCustomOrder = false`
- **reorderMobileItem(path, fromIndex, toIndex)**: Vertical reorder in mobile layout, sets `hasMobileCustomOrder = true`
- **Automatic sync useEffect**: Watches `layout` and `hasMobileCustomOrder`, applies appropriate sync strategy

#### Mobile Sync Strategy

**When desktop layout changes:**
- If `mobileLayout === null`: No sync (mobile not initialized)
- If `hasMobileCustomOrder === false`: Re-transform entire mobile from desktop
- If `hasMobileCustomOrder === true`: Smart merge to preserve custom order

**Smart merge rules:**
- Keep existing mobile order
- Add new desktop items at end
- Remove deleted desktop items
- Update nested structures
- Preserve reorder positions

---

## Component Details

### GridCanvas.tsx (Desktop Grid)

Renders desktop grid as CSS Grid layout container.

**Rendering Logic**:
1. Creates CSS Grid with `gridTemplateColumns: repeat(columnCount, 1fr)`
2. Dynamically calculates square cell size
3. Renders subtle grid line background
4. Maps layout to GridItem components
5. Handles palette drops

### GridItem.tsx (Desktop Item)

Renders individual grid item with 8-direction resize and drag.

**Resize Logic**: RAF-batched delta accumulation with grid snapping

**Drag Logic**: Accumulates movement, snaps to grid positions, resolves collisions

**Nesting**: Recursive GridItem for children, maintains coordinate system

### MobileGridCanvas.tsx (Mobile Container)

Renders vertical flex stack inside phone preview frame.

**Why Flex**: Simpler than grid, no coordinates needed, natural stacking

**Drag-to-Reorder**: Vertical only, calls `onReorderItem` with indices

### MobileGridItem.tsx (Mobile Item)

Renders item as draggable flex card with minimal styling.

**Path-Based Reorder**: Supports nested reorder via path + indices

---

## Data Flow

### Desktop

```
page.tsx 
  → useGridEngine 
    → GridCanvas 
      → GridItem (recursive)
        → Grid CSS with colStart/colEnd/rowStart/rowEnd
```

### Mobile

```
page.tsx 
  → useGridEngine 
    → MobileGridCanvas 
      → MobileGridItem (recursive)
        → Flex column with transformed layout
```

---

## Working Flows

### Adding Item (Desktop)

1. User drags from palette onto grid
2. GridCanvas.onDrop extracts pixel coordinates
3. pixelToGrid converts to grid position
4. useGridEngine.addItem creates and inserts item
5. resolveVerticalResize cascades overlapping items down
6. setLayout triggers re-render
7. CSS Grid positions items

### Resizing Item (Desktop)

1. User drags resize handle
2. RAF-batched accumulator tracks movement   
3. When accumulated delta >= cellSize, dimension increments
4. Direction-aware collision resolution shifts or wraps items
5. setLayout updates grid positions

### Mobile Sync Scenarios

#### Scenario 1: Clean Mobile (No Custom Order)
1. Add 3 items in desktop
2. Switch to mobile → `initMobileLayout()` transforms all 3 items
3. Go back to desktop, add 2 more items
4. Switch to mobile → `useEffect` detects clean state, re-transforms → shows all 5 items

#### Scenario 2: Custom Mobile Order
1. Add 3 items in desktop
2. Switch to mobile → shows 3 items in order
3. Reorder mobile items → `reorderMobileItem()` sets `hasMobileCustomOrder = true`
4. Go back to desktop, add 2 more items
5. Switch to mobile → `useEffect` detects custom order, smart merge:
   - Keeps 3 existing items in reordered positions ✅
   - Appends 2 new items at end ✅
   - Preserves custom mobile order ✅

#### Scenario 3: Item Deletion
1. Mobile has custom order with 5 items
2. Delete 1 item from desktop
3. Switch to mobile → Smart merge removes deleted item, keeps remaining 4 in custom order

---

## Design Decisions

### Why Hybrid Sync Strategy

- **Never stale**: Mobile layout automatically reflects desktop changes
- **Smart preservation**: Custom mobile order survives desktop modifications
- **Single source of truth**: Desktop remains authoritative for all items
- **No sync complexity**: Automatic merge handles additions, deletions, nesting
- **User expectation**: Mobile preview stays current with desktop editing

### Why Desktop is Single Source of Truth

- Precision positioning (125-column system)
- Full feature set (resize, collision, nesting)
- Users expect desktop editing
- Mobile is preview with reorder, not full editing surface

### Why Smart Merge Instead of Full Re-transform

- **Preserves user intent**: Mobile reorder is valuable customization
- **Handles additions gracefully**: New items append without disrupting order
- **Handles deletions cleanly**: Removed items disappear without breaking layout
- **Recursive nesting**: Works with arbitrary container depth
- **ID-based matching**: Robust against index changes

---

## Types

### GridItem

```typescript
export type GridItem = {
  id: string                    // Unique identifier
  colStart: number              // 0-indexed column
  colEnd: number                // Exclusive end column
  rowStart: number              // 0-indexed row
  rowEnd: number                // Exclusive end row
  children?: GridItem[]         // Nested items (recursive)
}

export const ROW_HEIGHT = 10    // Default row height in pixels
```

---

## Conclusion

This grid editor balances precision (desktop grid) with responsiveness (mobile projection), using a hybrid sync architecture. Desktop layout maintains full editing capability with collision detection and resizing; mobile automatically syncs with desktop changes while preserving user customizations through intelligent merge strategies. The system supports deep nesting and ensures mobile layouts never become stale.


```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


