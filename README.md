This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

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


useGridEngine.ts (Custom Hook)

Core layout engine.

Contains:

Layout state (tree-based)

Path-based navigation (findItemByPath, updateItemAtPath, deleteAtPath)

Collision resolvers:

resolveVerticalResizeInContainer

resolveHorizontalResizeInContainer

resolveDragInContainer

resolveCollisionsInContainer

Add / Move / Resize / Remove logic

Pixel → Grid conversion

Nested container support

Axis-aware resizing

Desktop/mobile independent instances supported

This is your business logic layer.

2️⃣ GridCanvas.tsx

Root grid surface component.

Responsibilities:

Renders top-level CSS grid

Handles drag-drop from palette

Clears selection on empty click

Delegates interactions to engine

Renders root GridItem components

This is your grid surface layer.

3️⃣ GridItem.tsx

Recursive item component.

Responsibilities:

Renders individual grid item

Drag-to-move with snapping

8-direction resize

Pointer event handling with RAF batching

Nested grid container rendering

Scoped drag/drop for child items

Selection handling (path-based)

Delete button

Depth-controlled nesting

This is your interaction + recursive UI layer.

4️⃣ grid.ts (Type Definition)
export type GridItem = {
  id: string;
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
  children?: GridItem[];
}

Plus:

export const ROW_HEIGHT = 40;
5️⃣ app/page.tsx (Home Page)

Main layout orchestrator.

Contains:

Two independent engines:

Desktop → 125 columns

Mobile → 40 columns

View mode switcher (desktop/mobile)

Renders Palette

Renders GridCanvas

Optional Sidebar (currently commented)

This is your composition/root orchestration layer.