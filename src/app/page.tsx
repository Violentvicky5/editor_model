'use client';

import { Palette } from '@/components/Palette';
import { GridCanvas } from '@/components/GridCanvas';
import { Sidebar } from '@/components/Sidebar';
import { useGridEngine } from '@/hooks/useGridEngine';

export default function Home() {
  const {
    layout,
    columnCount,
    rowHeight,
    selectedItemPath,
    selectedItem,
    addItem,
    moveItem,
    resizeItem,
    removeItem,
    selectItem,
    initializeChildrenGrid,
  } = useGridEngine();

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
              <h1 className="text-2xl font-bold text-gray-800">EDITOR</h1>
              <p className="text-sm text-gray-600 mt-1">
                Columns: <span className="font-semibold">{columnCount}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Grid Container */}
        <div className="flex-1 overflow-auto p-6">
          <GridCanvas
            layout={layout}
            columnCount={columnCount}
            rowHeight={rowHeight}
            selectedItemPath={selectedItemPath}
            onSelectItem={selectItem}
            onAddItem={addItem}
            onMoveItem={moveItem}
            onResizeItem={resizeItem}
            onRemoveItem={removeItem}
            onInitializeChildren={initializeChildrenGrid}
          />
        </div>
      </div>

      {/* Right Sidebar Properties */}
      <Sidebar
        selectedItem={selectedItem}
        columnCount={columnCount}
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
    </div>
  );
}
