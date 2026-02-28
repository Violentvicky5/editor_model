export type GridItem = {
  id: string;
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
};

// we keep ROW_HEIGHT only as a default/fallback, actual height
// is computed dynamically by the engine based on window width.
export const ROW_HEIGHT = 40; // default pixels
