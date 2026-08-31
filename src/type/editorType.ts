import Konva from "konva";
import { SetURLSearchParams } from "react-router-dom";


//  ── Canvas Object Type ──────────────────────────────────────────────
export interface CanvasState{
  frames: Frame[];
  width : number;
  height: number;
}

export interface Frame{
  id: string;
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


export interface UseEditorProps{
    stageRef: React.RefObject<Konva.Stage | null>;
    layerCanvasRefs: React.RefObject<Record<string, HTMLCanvasElement>>,
    state: CanvasState;
    //zoom: number;
    isLoggedIn: boolean;
    setUnsaved: (unsaved: boolean) => void;
    setSearchParams: SetURLSearchParams;
}

export interface SaveData{
    title: string;
    isPublic: boolean;
}

// 모달에 관한 함수
export interface SaveProjectModeProps{
    isOpen: boolean; // 모달이 열려있는지 여부
    onClose: () => void; // 모달을 닫는 함수
    onSave:(projectData: SaveData) => void; // 최종 저장을 처리할 함수
    initialTitle?:string;
    initialIsPublic?: boolean;
}

//  ── Menu Type ──────────────────────────────────────────────
export const MENU_GROUP_ID = {
  FILE: 'file',
  EDIT: 'edit',
  IMAGE: 'image',
  VIEW: 'view',
  LAYER: 'layer',
  DRAWING_GUIDE: 'guide',
} as const;

export type MenuGroupId = typeof MENU_GROUP_ID[keyof typeof MENU_GROUP_ID];

export const MENU_ACTION = {
  // Menu -> File
  NEW_PROJECT: 'NEW_PROJECT',
  OPEN_PROJECT: 'OPEN_PROJECT',
  OPEN_PPIT: 'OPEN_PPIT',
  SAVE: 'SAVE',
  BROWSER_SAVE: 'BROWSER_SAVE',
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

  // Menu -> Image
  FLIP_HORIZONTAL: 'FLIP_HORIZONTAL',
  FLIP_VERTICAL: 'FLIP_VERTICAL',
  ROTATE_90_CW: 'ROTATE_90_CW',

  // Menu -> View
  FIT_SCREEN: 'FIT_SCREEN',
  TOGGLE_GRID: 'TOGGLE_GRID',

  // Menu -> Layer
  ADD_LAYER: 'ADD_LAYER',
  DELETE_LAYER: 'DELETE_LAYER',
  DUPLICATE: 'DUPLICATE',
  MOVE_UP: 'MOVE_UP',
  MOVE_DOWN: 'MOVE_DOWN',
  MERGE_VISIBLE: 'MERGE_VISIBLE',
  FLATTEN: 'FLATTEN',
  
// Menu -> Pixel-Guide (기존 AI_GUIDE 대체 및 확장)
  TOGGLE_PIXEL_COUNTER: 'TOGGLE_PIXEL_COUNTER', // 실시간 픽셀 수치/길이 표시 토글
  TOGGLE_RATIO_GUIDE: 'TOGGLE_RATIO_GUIDE',     // 대각선 비율(2:1 등) 가이드 토글
  TOGGLE_GRID_SNAP: 'TOGGLE_GRID_SNAP',         // 8/16/32px 단위 스냅 토글
  TOGGLE_AI_GUIDE: 'TOGGLE_AI_GUIDE',           // AI 기반 스타일/드로잉 보조 가이드
} as const;

export type MenuActionId = typeof MENU_ACTION[keyof typeof MENU_ACTION];

export interface BaseMenuItem {
  id: MenuActionId; // 실행할 Command ID
  label: string;
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
  label: string;
  items: MenuItem[];
}








