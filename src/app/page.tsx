 'use client';

import React, { useState } from 'react';
import { Palette } from '@/components/Palette';
import { GridCanvas } from '@/components/GridCanvas';
import { Sidebar } from '@/components/Sidebar';
import { useGridEngine } from '@/hooks/useGridEngine';
import Icon from '@mdi/react';
import { mdiMonitor, mdiCellphone } from '@mdi/js';
export default function Home() {
  type ViewMode = 'desktop' | 'mobile';
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');

  // Two independent engines (separate layout state)
  const desktopEngine = useGridEngine(125);
  const mobileEngine = useGridEngine(40);

  const {
    layout: dLayout,
    columnCount: dColumnCount,
    rowHeight: dRowHeight,
    selectedItemPath: dSelectedItemPath,
    selectedItem: dSelectedItem,
    addItem: dAddItem,
    moveItem: dMoveItem,
    resizeItem: dResizeItem,
    removeItem: dRemoveItem,
    selectItem: dSelectItem,
  
  } = desktopEngine;

  const {
    layout: mLayout,
    // we intentionally read mobile rowHeight/selected state from its engine
    rowHeight: mRowHeight,
    selectedItemPath: mSelectedItemPath,
    selectedItem: mSelectedItem,
    addItem: mAddItem,
    moveItem: mMoveItem,
    resizeItem: mResizeItem,
    removeItem: mRemoveItem,
    selectItem: mSelectItem,
  
  } = mobileEngine;

  const mColumnCount = mobileEngine.columnCount;
  const activeColumnCount = viewMode === 'desktop' ? dColumnCount : mColumnCount;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar Palette */}
      <Palette />

      {/* Main Grid Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[14px] font-bold text-gray-800">EDITOR</h1>
              <p className="text-sm text-gray-600 mt-1">
                Columns: <span className="font-semibold">{activeColumnCount}</span>
              </p>
            </div>

          <div className="flex gap-3 items-center">
  <button
    onClick={() => setViewMode("desktop")}
    className={`p-2 rounded ${
      viewMode === "desktop"
        ? "bg-gray-500 text-white "
        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
    }`}
  >
    <Icon path={mdiMonitor} size={1} />
  </button>

  <button
    onClick={() => setViewMode("mobile")}
    className={`p-2 rounded ${
      viewMode === "mobile"
        ? "bg-gray-500 text-white "
        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
    }`}
  >
    <Icon path={mdiCellphone} size={1} />
  </button>
</div>
          </div>
        </div>

        {/* Grid Container */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'desktop' ? (
            <GridCanvas
              layout={dLayout}
              columnCount={dColumnCount}
              rowHeight={dRowHeight}
              selectedItemPath={dSelectedItemPath}
              onSelectItem={dSelectItem}
              onAddItem={dAddItem}
              onMoveItem={dMoveItem}
              onResizeItem={dResizeItem}
              onRemoveItem={dRemoveItem}
            
            />
          ) : (
            <div className="flex justify-center w-full">
              <div className="w-[400px] min-h-[600px] bg-white relative">
                <GridCanvas
                  layout={mLayout}
                  columnCount={mColumnCount}
                  rowHeight={mRowHeight}
                  selectedItemPath={mSelectedItemPath}
                  onSelectItem={mSelectItem}
                  onAddItem={mAddItem}
                  onMoveItem={mMoveItem}
                  onResizeItem={mResizeItem}
                  onRemoveItem={mRemoveItem}
                  
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar Properties bound to active engine */}
      <Sidebar
        selectedItem={viewMode === 'desktop' ? dSelectedItem : mSelectedItem}
        columnCount={activeColumnCount}
        onMoveItem={(itemId, col, row) => {
          if ((viewMode === 'desktop' ? dSelectedItemPath : mSelectedItemPath).length > 0) {
            const path = viewMode === 'desktop' ? dSelectedItemPath : mSelectedItemPath;
            const mover = viewMode === 'desktop' ? dMoveItem : mMoveItem;
            mover(path, col, row);
          }
        }}
        onResizeItem={(itemId, direction, deltaX, deltaY, containerRect) => {
          if ((viewMode === 'desktop' ? dSelectedItemPath : mSelectedItemPath).length > 0) {
            const path = viewMode === 'desktop' ? dSelectedItemPath : mSelectedItemPath;
            const resizer = viewMode === 'desktop' ? dResizeItem : mResizeItem;
            resizer(path, direction, deltaX, deltaY, containerRect);
          }
        }}
        onRemoveItem={(itemId) => {
          if ((viewMode === 'desktop' ? dSelectedItemPath : mSelectedItemPath).length > 0) {
            const path = viewMode === 'desktop' ? dSelectedItemPath : mSelectedItemPath;
            const remover = viewMode === 'desktop' ? dRemoveItem : mRemoveItem;
            remover(path);
          }
        }}
      />
    </div>
  );
}
