import { CanvasData, LayerData } from "./type";


export const createDefaultLayer = (): LayerData => ({
  id: crypto.randomUUID(), // 레이어의 고유 ID
  name: 'Background',      // 첫 레이어 이름
  layerOrder: 0, // 현재 개수를 순서로 지정
  blendMode: 'NORMAL',
  isLocked: false,
  isVisible: true,           // 기본적으로 보임 상태
  opacity: 1.0,
  color: '#818cf8',      // 기본 식별 색상 (원치 않으면 null)
  pixelData: '',
});

export const createInitialCanvasData = (): CanvasData => ({
  frames: [{id: crypto.randomUUID(), data: null, width: 32, height: 32, layers: [createDefaultLayer()]}],
  currentFrameIdx: 0,
  width: 32,
  height: 32,
});

// ── 상수 ──────────────────────────────────────────────
export const DRAW_TOOLS = [
  { id: 'pencil',    icon: 'edit',               label: 'Pencil (P)' },
  { id: 'eraser',    icon: 'ink_eraser',          label: 'Eraser (E)' },
  { id: 'fill',      icon: 'format_color_fill',   label: 'Fill (G)' },
  { id: 'eyedrop',   icon: 'colorize',            label: 'Eyedropper (I)' },
]

export const SELECT_TOOLS = [
  { id: 'marquee',   icon: 'select_all',          label: 'Marquee (M)' },
  { id: 'lasso',     icon: 'gesture',             label: 'Lasso (L)' },
  { id: 'move',      icon: 'open_with',           label: 'Move (V)' },
]
export const SHAPE_TOOLS = [
  { id: 'line',      icon: 'horizontal_rule',     label: 'Line' },
  { id: 'rect',      icon: 'rectangle',           label: 'Rectangle (R)' },
  { id: 'ellipse',   icon: 'circle',              label: 'Ellipse (O)' },
]
export const VIEW_TOOLS = [
  { id: 'zoom',      icon: 'search',              label: 'Zoom (Z)' },
  { id: 'pan',       icon: 'pan_tool',            label: 'Pan (Space)' },
]

export const PALETTE_COLORS = [
  '#2f81f7','#818cf8','#c0c1ff','#29282b',
  '#191c1e','#494454','#7b7486','#f7f9fb',
  '#ffffff','#ba1a1a','#ffdad6','#16a34a',
  '#d1fae5','#f59e0b','#fef3c7','#06b6d4',
  '#cffafe','#ec4899','#fce7f3','#78350f',
  '#d97706',
]

export const ZOOM_LEVELS = [1, 2, 4, 8, 10, 16, 20, 32, 64];
export const CANVAS_PRESETS = ['8×8','16×16','32×32','64×64','128×128'];

export const MAX_HISTORY_SIZE = 50;

