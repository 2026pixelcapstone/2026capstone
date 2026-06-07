import Konva from "konva";

//  ── Editor ──────────────────────────────────────────────
export interface CanvasData{
  frames: Frame[];
  currentFrameIdx: number;
  width : number;
  height: number;
}

export interface Frame{
    id: string;
    layers: LayerData[]
}

export interface SaveData{
    title: string;
    isPublic: boolean;
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
    pixelData: string | null;
}

export interface useEditorProps{
    stageRef: React.RefObject<Konva.Stage | null>;
    canvasW: number;
    canvasH: number;
    zoom: number;
    isLoggedIn: boolean;
    layers: LayerData[];
    setUnsaved: (unsaved: boolean) => void;
    setSearchParams: any;
}
