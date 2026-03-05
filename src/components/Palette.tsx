"use client";
import { PALETTE_ITEMS } from "../data/data";

export function Palette() {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", "palette-item");
  };

  return (
    <div className="w-72 bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Components</h2>
      <div className="space-y-2">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={handleDragStart}
            className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-gray-300 transition-colors"
          >
            {/* <span className="text-xl">{item.icon}</span>*/}
            <div>
              <p className="font-medium text-gray-700">{item.label}</p>
              <p className="text-xs text-gray-500">Drag to grid</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
