 'use client';

import React, { useState, useEffect } from 'react';
import { Palette } from '@/components/Palette';
import { GridCanvas } from '@/components/GridCanvas';
import { MobileGridCanvas } from '@/components/MobileGridCanvas';
import { Sidebar } from '@/components/Sidebar';
import { useGridEngine } from '@/hooks/useGridEngine';
import Icon from '@mdi/react';
import { mdiMonitor, mdiCellphone } from '@mdi/js';
export default function Home() {
  type ViewMode = 'desktop' | 'mobile';
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');

  // Single desktop engine (source of truth)
  const desktopEngine = useGridEngine(125);

  const {
    layout: desktopLayout,
    mobileLayout,
    columnCount: desktopColumnCount,
    rowHeight,
    selectedItemPath,
    selectedItem,
    addItem,
    moveItem,
    resizeItem,
    removeItem,
    selectItem,
    initMobileLayout,
    reorderMobileItem,
  } = desktopEngine;

  // Initialize mobile layout when switching to mobile view (first time only)
  useEffect(() => {
    if (viewMode === 'mobile' && mobileLayout === null) {
      initMobileLayout();
    }
  }, [viewMode, mobileLayout, initMobileLayout]);

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
                {viewMode === 'desktop' ? (
                  <>Columns: <span className="font-semibold">{desktopColumnCount}</span></>
                ) : (
                  <>Mobile Stack (Full Width)</>
                )}
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
              layout={desktopLayout}
              columnCount={desktopColumnCount}
              rowHeight={rowHeight}
              selectedItemPath={selectedItemPath}
              onSelectItem={selectItem}
              onAddItem={addItem}
              onMoveItem={moveItem}
              onResizeItem={resizeItem}
              onRemoveItem={removeItem}
            />
          ) : (
            // compact iPhone preview
            <div className="flex justify-center items-center w-full h-full p-2">
              <div className="flex justify-center items-center h-full min-h-0">
                <div className=" w-[386px] h-[675px] bg-olive-700 rounded-[38px] p-[3px] shadow-2xl relative overflow-hidden">
                  {/* clean notch */}
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-[20px] z-10" />
                  <div className="phone-scroll w-full h-full bg-white rounded-[34px] overflow-y-auto overflow-x-hidden p-3 box-border">
                    {mobileLayout && (
                      <MobileGridCanvas
                        layout={mobileLayout}
                        selectedItemPath={selectedItemPath}
                        onSelectItem={selectItem}
                        onReorderItem={reorderMobileItem}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar Properties bound to desktop engine */}
      {viewMode === 'desktop' && (
        <Sidebar
          selectedItem={selectedItem}
          columnCount={desktopColumnCount}
          onMoveItem={(itemId, col, row) => {
            if (selectedItemPath.length > 0) {
              moveItem(selectedItemPath, col, row);
            }
          }}
          onResizeItem={(itemId, direction, deltaX, deltaY, containerRect) => {
            if (selectedItemPath.length > 0) {
              resizeItem(selectedItemPath, direction, deltaX, deltaY, containerRect);
            }
          }}
          onRemoveItem={(itemId) => {
            if (selectedItemPath.length > 0) {
              removeItem(selectedItemPath);
            }
          }}
        />
      )}
    </div>
  );
}
