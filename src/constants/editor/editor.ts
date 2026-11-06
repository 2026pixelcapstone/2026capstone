import { BlendMode, CanvasState, LayerData } from "../../type/editor";

// ── 캔버스 기본 값 ──────────────────────────────────────────────
export const createDefaultLayer = (): LayerData => ({
  id: `layer-${crypto.randomUUID().slice(0, 8)}`, // 레이어의 고유 ID
  name: '배경', // 첫 레이어 이름(PR-F: Background → 한국어)
  layerOrder: 0,
  blendMode: 'NORMAL',
  isLocked: false,
  isVisible: true, // 기본적으로 보임 상태
  opacity: 100,
  color: '#818cf8', // 기본 식별 색상 (원치 않으면 null)
  pixelData: '',
});

export const createInitialCanvasData = (): CanvasState => ({
  frames: [{id: `frame-${crypto.randomUUID()}`, frameOrder: 0, duration: 100, layers: [createDefaultLayer()]}],
  animationTags: [],
  width: 32,
  height: 32,
});

/** 새 작업 기본 제목(PR-F: 'Untitled Project' → 한국어) */
export const DEFAULT_PROJECT_TITLE = '제목 없음';

// ── 도구 구성 ──────────────────────────────────────────────
export const DRAW_TOOLS = [
  { id: 'pencil',    icon: 'edit',               label: '연필 (P)' },
  { id: 'eraser',    icon: 'ink_eraser',          label: '지우개 (E)' },
  { id: 'fill',      icon: 'format_color_fill',   label: '채우기 (G)' },
  { id: 'eyedrop',   icon: 'colorize',            label: '스포이드 (I, Alt)' },
] as const;

export const SELECT_TOOLS = [
  { id: 'marquee',   icon: 'select_all',          label: '사각 선택 (M)' },
  { id: 'lasso',     icon: 'gesture',             label: '올가미 (Q)' },
  { id: 'move',      icon: 'open_with',           label: '이동 (V)' },
] as const;
export const SHAPE_TOOLS = [
  { id: 'line',      icon: 'horizontal_rule',     label: '직선 (L)' },
  { id: 'rect',      icon: 'rectangle',           label: '사각형 (R)' },
  { id: 'ellipse',   icon: 'circle',              label: '원 (O)' },
] as const;

export const VIEW_TOOLS = [
  { id: 'pan',       icon: 'pan_tool',            label: '손 (H, Space)' },
] as const;

export const COLOR_TOOLS = [
  {id: 'color', icon: 'color', label: '색' },
] as const;


export const PALETTE_COLORS = [
  '#2f81f7','#818cf8','#c0c1ff','#29282b',
  '#191c1e','#494454','#7b7486','#f7f9fb',
  '#ffffff','#ba1a1a','#ffdad6','#16a34a',
  '#d1fae5','#f59e0b','#fef3c7','#06b6d4',
  '#cffafe','#ec4899','#fce7f3','#78350f',
  '#d97706',
]

// ── 블렌드 모드 상수 ──────────────────────────────────────────────
export const BLEND_MODES: { value: BlendMode; label: string }[] = [
    { value: 'NORMAL', label: 'Normal' },
    { value: 'MULTIPLY', label: 'Multiply' },
    { value: 'SCREEN', label: 'Screen' },
    { value: 'OVERLAY', label: 'Overlay' },
    { value: 'DARKEN', label: 'Darken' },
    { value: 'LIGHTEN', label: 'Lighten' },
];

// ── 캔버스 설정 상수 ──────────────────────────────────────────────
export const ZOOM_LEVELS = [1, 2, 4, 8, 10, 16, 20, 32, 64];
export const CANVAS_PRESETS = ['8×8','16×16','32×32','64×64','128×128', '256×256', '512×512'];

export const MAX_CANVAS_SIZE = 512; // 캔버스 최대 크기 제한
export const MAX_HISTORY_SIZE = 50; // 최대 히스토리 스택 크기 제한

export const MAX_DURATION = 10000; // 애니메이션 프레임 최대 지속 시간 제한
export const MIN_DURATION_30FPS = 33; // 애니메이션 재생 속도 제한
