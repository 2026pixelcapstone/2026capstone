// ── 프로젝트 로드 타입(useEditorLoad 훅에서 쓰임) ──────────────────────────────────────────────
export interface LoadedEditorProject{
  projectId: number;
  title: string;
  width: number;
  height: number;
  frames: FrameData[];
  isPublic: boolean;
  palette: string[] | null;
}

// ── 상세 화면 타입 ──────────────────────────────────────────────
export interface FrameViewData{
  id: string | null;
  duration: number | null;
  tagId: string | null;
}

export interface LayerViewData{
  id: string | null;
  name: string;
  opacity: number;
  blendMode: string;
}

//  ── Canvas Object Type ──────────────────────────────────────────────
export interface AnimationTag {
    id: string;
    name: string;        // 예: "Walk", "Attack"
    color: string;       // 태그의 시각적 구분 색상 (예: #ff0000)
    fromIndex: number;   // 태그 시작 프레임 인덱스
    toIndex: number;     // 태그 끝 프레임 인덱스
}

export interface CanvasState{
  frames: FrameData[];
  animationTags?: AnimationTag[];
  width : number;
  height: number;
}

export interface FrameData{
  id: string;
  tagId?: string | null;
  frameOrder?: number;
  duration?: number;
  layers: LayerData[]
}

export type BlendMode = 'NORMAL' | 'MULTIPLY' | 'SCREEN' | 'OVERLAY' | 'DARKEN' | 'LIGHTEN';

export interface LayerData{
  id: string; // ID는 문자열로 관리하는 것이 확장성에 좋습니다.
  name: string;
  layerOrder: number;
  blendMode: BlendMode;
  isLocked: boolean;
  isVisible: boolean;
  opacity: number;
  color: string | null; // 색상이 없을 수도 있으니 null 허용
  pixelData: string;
}

export interface CanvasSize{
  width: number;
  height: number;
}

export interface SaveModelData{
    title: string;
    isPublic: boolean;
}

// ── 번역(한글 | 영문) ──────────────────────────────────────────────
export type Lang = 'ko' | 'en';

// 기본 언어 설정 (현재 'ko'로 고정)
export const CURRENT_LANG: Lang = 'ko';

export interface LocalizedText {
  ko: string;
  en: string;
}

//  ── Menu Type ──────────────────────────────────────────────
export const MENU_GROUP_ID = {
  FILE: 'file',
  EDIT: 'edit',
  IMAGE: 'image',
  VIEW: 'view',
  LAYER: 'layer',
  FRAME: 'frame',
  DRAWING_GUIDE: 'guide',
  HELP: 'help',
} as const;

export type MenuGroupId = typeof MENU_GROUP_ID[keyof typeof MENU_GROUP_ID];

export const MENU_ACTION = {
  // Menu -> File
  NEW_PROJECT: 'NEW_PROJECT',
  OPEN_PROJECT: 'OPEN_PROJECT',
  CLOSE_TAB: 'CLOSE_TAB',               // 탭 닫기(PR-E)
  SEND_TO_TAB: 'SEND_TO_TAB',           // 다른 탭으로 보내기(PR-E)
  OPEN_PPIT: 'OPEN_PPIT',
  IMPORT_IMAGE: 'IMPORT_IMAGE',         // 이미지 불러오기(새 레이어)
  OPEN_REFERENCE: 'OPEN_REFERENCE',     // 참조 이미지 열기
  SHARE_GALLERY: 'SHARE_GALLERY',       // 갤러리에 공유
  JOIN_CHALLENGE: 'JOIN_CHALLENGE',     // 이번 주 챌린지에 참가
  REGISTER_ASSET: 'REGISTER_ASSET',     // 에셋 스토어에 등록
  SAVE: 'SAVE',
  SAVE_AS: 'SAVE_AS',
  EXPORT_IMAGE: 'EXPORT_IMAGE',
  EXPORT_SPRITESHEET: 'EXPORT_SPRITESHEET',
  DOWNLOAD_PPIT: 'DOWNLOAD_PPIT',
  BACK_TO_MAIN: 'BACK_TO_MAIN',

  // Menu -> Edit
  UNDO: 'UNDO',
  REDO: 'REDO',
  CUT: 'CUT',
  COPY: 'COPY',
  PASTE: 'PASTE',
  RESIZE: 'RESIZE',
  SELECT_ALL: 'SELECT_ALL',
  DESELECT: 'DESELECT',
  INVERT_SELECTION: 'INVERT_SELECTION', // 선택 반전(PR-F)
  CROP_TO_SELECTION: 'CROP_TO_SELECTION', // 선택 영역으로 캔버스 자르기
  TRIM_CANVAS: 'TRIM_CANVAS',           // 빈 여백 자르기
  CLEAR_LAYER: 'CLEAR_LAYER',           // 레이어 내용 지우기
  SEL_FLIP_H: 'SEL_FLIP_H',             // 선택 영역 뒤집기·회전(PR-G)
  SEL_FLIP_V: 'SEL_FLIP_V',
  SEL_ROT_CW: 'SEL_ROT_CW',
  SEL_ROT_CCW: 'SEL_ROT_CCW',
  TOGGLE_WRAP: 'TOGGLE_WRAP',           // 타일 모드 그리기(PR-G)

  // Menu -> Image
  FLIP_HORIZONTAL: 'FLIP_HORIZONTAL',
  FLIP_VERTICAL: 'FLIP_VERTICAL',
  ROTATE_90_CW: 'ROTATE_90_CW',
  ROTATE_90_CCW: 'ROTATE_90_CCW',
  ROTATE_180: 'ROTATE_180',
  ADJUST_HSB: 'ADJUST_HSB',             // 색조·채도·밝기
  ADJUST_INVERT: 'ADJUST_INVERT',       // 색 반전
  ADJUST_GRAY: 'ADJUST_GRAY',           // 흑백
  SNAP_TO_PALETTE: 'SNAP_TO_PALETTE',   // 팔레트로 맞추기
  ADD_OUTLINE: 'ADD_OUTLINE',           // 외곽선 추가
  REPLACE_COLOR: 'REPLACE_COLOR',       // 색 바꾸기
  TOGGLE_PALETTE_LOCK: 'TOGGLE_PALETTE_LOCK', // 팔레트 잠금

  // Menu -> View
  FIT_SCREEN: 'FIT_SCREEN',
  ZOOM_IN: 'ZOOM_IN',                   // 확대·축소·실제 크기(PR-F)
  ZOOM_OUT: 'ZOOM_OUT',
  ZOOM_ACTUAL: 'ZOOM_ACTUAL',
  TOGGLE_GRID: 'TOGGLE_GRID',
  TOGGLE_ONION_SKIN: 'TOGGLE_ONION_SKIN',
  TOGGLE_REFERENCE: 'TOGGLE_REFERENCE',
  TILE_PREVIEW: 'TILE_PREVIEW',         // 미리보기 창을 타일 모드로
  RECOLOR: 'RECOLOR',                   // 팔레트로 다시 칠하기
  DUPLICATE_FRAME: 'DUPLICATE_FRAME',   // 프레임 복제
  GAME_PREVIEW: 'GAME_PREVIEW',         // 게임 미리보기
  ADD_FRAME: 'ADD_FRAME',               // 프레임 메뉴 보강(PR-F)
  DELETE_FRAME: 'DELETE_FRAME',
  PREV_FRAME: 'PREV_FRAME',
  NEXT_FRAME: 'NEXT_FRAME',
  TOGGLE_PLAY: 'TOGGLE_PLAY',
  REVERSE_FRAMES: 'REVERSE_FRAMES',

  // Menu -> Layer
  ADD_LAYER: 'ADD_LAYER',
  DELETE_LAYER: 'DELETE_LAYER',
  DUPLICATE: 'DUPLICATE',
  MOVE_UP: 'MOVE_UP',
  MOVE_DOWN: 'MOVE_DOWN',
  MERGE_VISIBLE: 'MERGE_VISIBLE',
  FLATTEN: 'FLATTEN',
  MERGE_DOWN: 'MERGE_DOWN',             // 아래 레이어와 병합(PR-F)
  TOGGLE_LAYER_VISIBLE: 'TOGGLE_LAYER_VISIBLE',
  TOGGLE_LAYER_LOCK: 'TOGGLE_LAYER_LOCK',
  // Menu -> Help
  SHORTCUTS: 'SHORTCUTS',               // 단축키 목록(PR-F)
  
// Menu -> Pixel-Guide (기존 AI_GUIDE 대체 및 확장)
  TOGGLE_PIXEL_COUNTER: 'TOGGLE_PIXEL_COUNTER', // 실시간 픽셀 수치/길이 표시 토글
  TOGGLE_RATIO_GUIDE: 'TOGGLE_RATIO_GUIDE',     // 대각선 비율(2:1 등) 가이드 토글
  TOGGLE_GRID_SNAP: 'TOGGLE_GRID_SNAP',         // 8/16/32px 단위 스냅 토글
  TOGGLE_PREVIEW: 'TOGGLE_PREVIEW',             // 미리보기 창(실제 크기·실루엣·명도)
  // Menu -> AI 가이드 (기능마다 항목 하나, 고르면 오른쪽 패널에 그 기능만)
  AI_SHADE: 'AI_SHADE',               // 명암 가이드(자체 모델)
  AI_PALETTE: 'AI_PALETTE',           // 색 팔레트 추천
  AI_TAG_COLOR: 'AI_TAG_COLOR',       // 태그로 색 찾기
  AI_CONCEPT: 'AI_CONCEPT',           // 컨셉 도우미
  AI_INBETWEEN: 'AI_INBETWEEN',       // 중간 동작 제안(작업물 이해 모델 + 규칙)
  AI_ANIM_CHECK: 'AI_ANIM_CHECK',     // 애니메이션 일관성 검사(색 규칙)
} as const;

export type MenuActionId = typeof MENU_ACTION[keyof typeof MENU_ACTION];

/** AI 패널에 지금 보이는 기능(null = 패널 닫힘) */
export type AiTool = 'shade' | 'palette' | 'tagColor' | 'concept' | 'inbetween' | 'animCheck';

export interface BaseMenuItem {
  id: MenuActionId; // 실행할 Command ID
  label: LocalizedText;
  shortcut?: string;
  icon?: string;
  disabled?: boolean;
}

export interface MenuSeparator {
  separator: true;
}

export type MenuItem = BaseMenuItem | MenuSeparator;

export interface MenuGroup {
  id: MenuGroupId;
  label: LocalizedText;
  items: MenuItem[];
}

// ── ToolType ──────────────────────────────────────────────

// 도구 아이디 타입 정의
export type DrawToolId = 'pencil' | 'eraser' | 'fill' | 'eyedrop' | 'shade';
export type SelectToolId = 'marquee' | 'lasso' | 'wand' | 'move';
export type ShapeToolId = 'line' | 'rect' | 'ellipse';
export type ViewToolId = 'pan';
export type ColorToolId = 'color';

// 도구 아이디를 하나로 묶은 타입 정의
export type EditorToolId = DrawToolId | SelectToolId | ShapeToolId | ViewToolId | ColorToolId;

export interface Point {
    x: number;
    y: number;
}