 'use client';

import React, { useState, useEffect } from 'react';
import { Palette } from '@/components/Palette';
import { GridCanvas } from '@/components/GridCanvas';
import { MobileGridCanvas } from '@/components/MobileGridCanvas';
import { Sidebar } from '@/components/Sidebar';
import { useGridEngine } from '@/hooks/useGridEngine';
import Icon from '@mdi/react';
import { mdiMonitor, mdiCellphone } from '@mdi/js';
import { ViewMode } from '@/types/grid';
export default function Home() {
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
        <div className="bg-white border-b border-gray-200 px-6 py-1 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[14px] font-bold text-gray-800">EDITOR</h1>
              <p className="text-sm text-gray-600 mt-1">
                {viewMode === 'desktop' ? (
                  <>Columns: <span className="font-semibold">{desktopColumnCount}</span></>
                ) : (
                  <>Mobile view</>
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
           <div className="flex justify-center items-center w-full h-full p-6 bg-gray-100">

  {/* iPhone Body */}
  <div className="relative flex items-center justify-center">

    {/* Metal Frame */}
    <div className="relativew-full max-w-[340px] aspect-[340/560] rounded-[48px] bg-gradient-to-b from-gray-300 via-gray-500 to-gray-700 p-[6px] shadow-[0_35px_80px_rgba(0,0,0,0.45)]">

      {/* Side Buttons */}
      <div className="absolute left-[4px] top-[120px] w-[3px] h-[40px] bg-gray-600 rounded-full"></div>
      <div className="absolute left-[4px] top-[170px] w-[3px] h-[60px] bg-gray-600 rounded-full"></div>
      <div className="absolute right-[4px] top-[150px] w-[3px] h-[80px] bg-gray-600 rounded-full"></div>

      {/* Inner Black Bezel */}
      <div className="relative w-full h-full bg-black rounded-[44px] p-[6px]">

        {/* Screen Container */}
        <div className="relative w-full h-full bg-white rounded-[36px] overflow-hidden">

          {/* Notch */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[120px] h-[26px] bg-black rounded-full flex items-center justify-center gap-2 z-20">

            {/* Camera */}
            <div className="w-[8px] h-[8px] bg-gray-800 rounded-full border border-gray-600"></div>

            {/* Speaker */}
            <div className="w-[40px] h-[4px] bg-gray-700 rounded-full"></div>

          </div>

          {/* Scrollable Screen */}
          <div className="phone-scroll w-full h-full overflow-y-auto overflow-x-hidden p-4 pt-10">

            {/* Header */}
            <div className="w-full mb-4 px-4 py-3 text-lg font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-xl shadow-sm text-center">
              Mobile Preview
            </div>

            {mobileLayout && (
              <MobileGridCanvas
                layout={mobileLayout}
                selectedItemPath={selectedItemPath}
                onSelectItem={selectItem}
                onReorderItem={reorderMobileItem}
              />
            )}

          </div>

          {/* Home Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[5px] bg-gray-300 rounded-full"></div>

        </div>
      </div>

    </div>

  </div>
</div>
          )}
        </div>
      </div>

      {/* Right Sidebar Properties bound to desktop engine 
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
      )}*/}
    </div>
  );
}
