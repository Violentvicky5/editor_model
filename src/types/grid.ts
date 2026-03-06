import { Palette } from '@/components/Palette';
export type GridItem = {
  label: string; // e.g. "card", "chart", etc.
  id: string;
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
  children?: GridItem[]; // Recursive: nested items use same coordinate system (0-124)
} 

// we keep ROW_HEIGHT only as a default/fallback, actual height
// is computed dynamically by the engine based on window width.
export const ROW_HEIGHT = 10; // default pixels


//View modes
export type ViewMode=`desktop`|`mobile`;



export type PaletteItem ={
name: string;
label: string;
}

export type PaletteCategory = {
id: string;
label: string;
items: PaletteItem[];
}