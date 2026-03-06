"use client";
import { PALETTE_ITEMS2 } from "../data/data";
import { useState } from "react";
import {PaletteItem} from "@/types/grid";



export function Palette() {

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: PaletteItem) => {
    

   e.dataTransfer.effectAllowed = "copy";
   const data= JSON.stringify( item );
 e.dataTransfer.setData("text/plain", data);

     console.log("Drag started with data:", { data });
  };

const [openCategory, setOpenCategory] = useState<string | null>(null);


  return (

   <div className=" sm:w-50 md:w-64 bg-white border-r border-gray-200 p-3 sm:p-4 overflow-y-auto">

  <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4">
    Components
  </h2>

  {PALETTE_ITEMS2.map((category) => (
    <div key={category.id} className="mb-3 border border-gray-200 rounded-lg">

      {/* Category Header */}
      <button
        onClick={() =>
          setOpenCategory(openCategory === category.id ? null : category.id)
        }
        className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-[13px] sm:text-[14px] font-semibold text-gray-700"
      >
        {category.label}
      </button>

      {/* Dropdown Items */}
      {openCategory === category.id && (
        <div className="p-2 sm:p-3 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 gap-2 sm:gap-3">

          {category.items.map((item: { name: string; label: string }) => (
            <div
              key={item.name}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              className="group flex flex-col items-center justify-center gap-1 p-2 sm:p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200 cursor-move select-none"
            >

              <p className="text-[11px] sm:text-[12px] font-semibold text-gray-700 group-hover:text-blue-600">
                {item.label}
              </p>

              <p className="text-[10px] sm:text-[11px] text-gray-400">
                Drag
              </p>

            </div>
          ))}

        </div>
      )}
    </div>
  ))}
</div>
);
}
