'use client';

import { useState, useEffect } from 'react';
import { GridItem } from '@/types/grid';
import { ResizeDirection } from '@/hooks/useGridEngine';

interface SidebarProps {
  selectedItem: GridItem | null;
  columnCount: number;
  onResizeItem: (
    itemId: string,
    direction: ResizeDirection,
    deltaX: number,
    deltaY: number,
    containerRect: DOMRect
  ) => void;
}

export function Sidebar({ selectedItem, columnCount, onResizeItem }: SidebarProps) {
  const [colStart, setColStart] = useState('');
  const [colSpan, setColSpan] = useState('');
  const [rowSpan, setRowSpan] = useState('');

  useEffect(() => {
    if (selectedItem) {
      setColStart(String(selectedItem.colStart + 1)); // 1-indexed for user
      const span = selectedItem.colEnd - selectedItem.colStart;
      setColSpan(String(span));
      const rspan = selectedItem.rowEnd - selectedItem.rowStart;
      setRowSpan(String(rspan));
    } else {
      setColStart('');
      setColSpan('');
      setRowSpan('');
    }
  }, [selectedItem]);

  const handleColSpanChange = (newSpan: number) => {
    if (!selectedItem || newSpan < 1) return;
    const start = selectedItem.colStart;
    const newEnd = Math.min(start + newSpan, columnCount);
    const actualSpan = newEnd - start;
    const deltaCols = actualSpan - (selectedItem.colEnd - selectedItem.colStart);
    if (deltaCols !== 0) {
      // Simulate resizing east by delta columns
      const colWidth = 1; // fake unit; should be scaled; let engine handle it
      const deltaX = deltaCols * 50; // rough estimate; engine will normalize
      // We need a container rect; use a proxy
      const mockRect = new DOMRect(0, 0, columnCount * 50, 100);
      onResizeItem(selectedItem.id, 'e', deltaX, 0, mockRect);
      setColSpan(String(actualSpan));
    }
  };

  const handleRowSpanChange = (newSpan: number) => {
    if (!selectedItem || newSpan < 1) return;
    const start = selectedItem.rowStart;
    const newEnd = start + newSpan;
    const deltaRows = newSpan - (selectedItem.rowEnd - selectedItem.rowStart);
    if (deltaRows !== 0) {
      // Simulate resizing south by delta rows; assume 40px per row
      const rowHeight = 40;
      const deltaY = deltaRows * rowHeight;
      const mockRect = new DOMRect(0, 0, columnCount * 50, 500);
      onResizeItem(selectedItem.id, 's', 0, deltaY, mockRect);
      setRowSpan(String(newSpan));
    }
  };

  if (!selectedItem) {
    return (
      <div className="w-72 bg-white border-l border-gray-200 p-6 flex flex-col items-center justify-center text-center">
        <div className="text-gray-400">
          <p className="text-sm">Select an item to view and edit properties.</p>
        </div>
      </div>
    );
  }

  const currentColSpan = selectedItem.colEnd - selectedItem.colStart;
  const currentRowSpan = selectedItem.rowEnd - selectedItem.rowStart;

  return (
    <div className="w-72 bg-white border-l border-gray-200 p-6 overflow-y-auto">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Properties</h2>

      <div className="space-y-6">
        {/* Display coordinates */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Position</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 font-medium">Col Start</label>
              <input
                type="text"
                readOnly
                value={selectedItem.colStart + 1}
                className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium">Row Start</label>
              <input
                type="text"
                readOnly
                value={selectedItem.rowStart + 1}
                className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Editable span controls */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Size</p>
          <div className="space-y-3">
            <div>
              <label htmlFor="colSpan" className="text-xs text-gray-600 font-medium">
                Column Span
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="colSpan"
                  type="number"
                  min="1"
                  max={columnCount - selectedItem.colStart}
                  value={colSpan}
                  onChange={(e) => {
                    const val = e.target.value;
                    setColSpan(val);
                    if (val) {
                      handleColSpanChange(parseInt(val, 10));
                    }
                  }}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-xs text-gray-500">cols</span>
              </div>
            </div>

            <div>
              <label htmlFor="rowSpan" className="text-xs text-gray-600 font-medium">
                Row Span
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="rowSpan"
                  type="number"
                  min="1"
                  value={rowSpan}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRowSpan(val);
                    if (val) {
                      handleRowSpanChange(parseInt(val, 10));
                    }
                  }}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-xs text-gray-500">rows</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actual calculated info */}
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bounds</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>
              <span className="font-medium">Col End:</span> {selectedItem.colEnd}
            </div>
            <div>
              <span className="font-medium">Row End:</span> {selectedItem.rowEnd}
            </div>
            <div>
              <span className="font-medium">Width:</span> {currentColSpan}
            </div>
            <div>
              <span className="font-medium">Height:</span> {currentRowSpan}
            </div>
          </div>
        </div>

        {/* ID info */}
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Item ID:</span> {selectedItem.id}
          </p>
        </div>
      </div>
    </div>
  );
}
