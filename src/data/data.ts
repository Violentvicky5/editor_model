import {  PaletteCategory } from '@/types/grid';

export const PALETTE_ITEMS = [
  { id: 'card', label: 'Card', },
  { id: 'chart', label: 'Chart',},
  { id: 'table', label: 'Table', },
  { id: 'widget', label: 'Widget', },
  { id: 'input', label: 'Input', },
  { id: 'button', label: 'Button', },
];


export const PALETTE_ITEMS2: PaletteCategory[] = [
  {
    id: "containers",
    label: "Containers",
    items: [
      {
        name: "card",
        label: "Card"
      },
      {
        name: "widget",
        label: "Widget"
      }
    ]
  },
  {
    id: "data",
    label: "Data Display",
    items: [
      {
        name: "chart",
        label: "Chart"
      },
      {
        name: "table",
        label: "Table"
      }
    ]
  },
  {
    id: "inputs",
    label: "Inputs",
    items: [
      {
        name: "input",
        label: "Input"
      },
      {
        name: "button",
        label: "Button"
      }
    ]
  }
];