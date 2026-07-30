import Konva from "konva";

//  ── Editor ──────────────────────────────────────────────
export interface CanvasData{
  frames: Frame[];
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
    pixelData: string;
}

export interface useEditorProps{
    stageRef: React.RefObject<Konva.Stage | null>;
    layerCanvasRefs: React.RefObject<Record<string, HTMLCanvasElement>>,
    state: CanvasData;
    //zoom: number;
    isLoggedIn: boolean;
    setUnsaved: (unsaved: boolean) => void;
    setSearchParams: any;
}

// 모달에 관한 함수
export interface SaveProjectModeProps{
    isOpen: boolean; // 모달이 열려있는지 여부
    onClose: () => void; // 모달을 닫는 함수
    onSave:(projectData: SaveData) => void; // 최종 저장을 처리할 함수
    initialTitle?:string;
    initialIsPublic?: boolean;
}