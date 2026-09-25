export type ToolType =
  | 'select'
  | 'pan'
  | 'pen'
  | 'rect'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'sticky'
  | 'text'
  | 'eraser';

export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation?: number;
  zIndex: number;
  updatedAt: number;
}

export interface PenElement extends BaseElement {
  type: 'pen';
  points: number[];
  color: string;
  strokeWidth: number;
}

export interface RectElement extends BaseElement {
  type: 'rect';
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
}

export interface CircleElement extends BaseElement {
  type: 'circle';
  radiusX: number;
  radiusY: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  points: number[];
  color: string;
  strokeWidth: number;
  pointerLength?: number;
  pointerWidth?: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  points: number[];
  color: string;
  strokeWidth: number;
}

export interface StickyElement extends BaseElement {
  type: 'sticky';
  width: number;
  height: number;
  text: string;
  color: StickyColor;
  fontSize: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  width?: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  width: number;
  height: number;
}

export type CanvasElement =
  | PenElement
  | RectElement
  | CircleElement
  | ArrowElement
  | LineElement
  | StickyElement
  | TextElement
  | ImageElement;

export interface CanvasState {
  scale: number;
  x: number;
  y: number;
}

export interface ToolProperties {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  stickyColor: StickyColor;
}

export type GridType = 'dots' | 'grid' | 'none';

export interface Collaborator {
  clientId: number;
  name: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
  };
}

