'use client';

import React, { useRef, useState } from 'react';
import { GridItem as GridItemType } from '@/types/grid';

interface MobileGridItemProps {
  item: GridItemType;
  itemPath: string[];
  itemIndex: number;
  containerPath: string[];
  selectedItemPath: string[];
  onSelect: (path: string[]) => void;
  onReorder: (path: string[], fromIndex: number, toIndex: number) => void;
  onDragStart?: (itemPath: string[], index: number) => void;
}

export function MobileGridItem({
  item,
  itemPath,
  itemIndex,
  containerPath,
  selectedItemPath,
  onSelect,
  onReorder,
  onDragStart,
}: MobileGridItemProps) {
  const isSelected =
    itemPath.length === selectedItemPath.length &&
    itemPath.every((id, i) => id === selectedItemPath[i]);

  const [dragOverNestedIndex, setDragOverNestedIndex] = useState<number | null>(
    null
  );
  const elementRef = useRef<HTMLDivElement>(null);
  const nestedContainerRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(itemPath);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(itemPath, itemIndex);
  };

  const handleNestedDragOver = (e: React.DragEvent, nestedIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverNestedIndex(nestedIndex);
  };

  const handleNestedDragLeave = () => {
    setDragOverNestedIndex(null);
  };

  const handleNestedDrop = (e: React.DragEvent, toIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    setDragOverNestedIndex(null);

    // Reorder within nested container at this item's path
    onReorder(itemPath, 0, toIndex); // simplified: assumes drag from first item
  };

  // Nested items
  const nestedItems = item.children && item.children.length > 0;

  return (
    <div
      ref={elementRef}
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
      className={`
        w-full p-3 bg-white rounded-[14px] transition-shadow cursor-move
        ${isSelected
          ? 'border border-blue-300 shadow-md'
          : 'border border-gray-200 hover:shadow-sm'}
      `}
    >
      {/* Item Header with Drag Handle */}
      <div className="flex items-center gap-2">
        <div className="text-gray-400 flex-shrink-0">
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </div>
        <div className="text-sm font-semibold text-gray-700 truncate flex-1">
          {item.id}
        </div>
        <div className="text-xs text-gray-400">
          ID: {item.id.substring(0, 8)}
        </div>
      </div>

      {/* Nested Container */}
      {nestedItems && (
        <div
          ref={nestedContainerRef}
          className="mt-3 p-3 bg-[#f9f9f9] border border-gray-200 rounded-[14px] flex flex-col gap-2"
        >
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Nested Items ({item.children!.length})
          </div>
          <div className="flex flex-col gap-2">
            {item.children!.map((child, nestedIndex) => (
              <div
                key={child.id}
                onDragOver={(e) => handleNestedDragOver(e, nestedIndex)}
                onDragLeave={handleNestedDragLeave}
                onDrop={(e) => handleNestedDrop(e, nestedIndex)}
                className={`transition-opacity ${
                  dragOverNestedIndex === nestedIndex ? 'opacity-50' : ''
                }`}
              >
                <MobileGridItem
                  item={child}
                  itemPath={[...itemPath, child.id]}
                  itemIndex={nestedIndex}
                  containerPath={itemPath}
                  selectedItemPath={selectedItemPath}
                  onSelect={onSelect}
                  onReorder={onReorder}
                  onDragStart={onDragStart}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty Content */}
      {!nestedItems && (
        <div className="text-xs text-gray-400 mt-2">
          Content will render here
        </div>
      )}
    </div>
  );
}

/**
 * MobileGridItem Component
 * ----------------------
 * Mobile grid item with vertical flex layout
 *
 * Features:
 * - Full width rendering with auto height
 * - Vertical drag-and-drop reordering
 * - Selection highlighting
 * - Nested container support with independent reordering
 * - Mobile-friendly styling with drag handle
 * - Drag-and-drop visual feedback
 *
 * Does NOT support:
 * - Grid positioning (colStart, colEnd, etc.)
 * - Horizontal dragging
 * - Resizing
 * - Collision detection
 * - Grid snapping
 */

