//  ── Editor ──────────────────────────────────────────────
export interface CanvasData{
  frames: Frame[];
  currentFrameIdx: number;
  width : number;
  height: number;
}

export interface Frame{
    id: string;
    data: string | null
    width: number;
    height: number;
}

export interface SaveData{
    title: string;
    isPublic: boolean;
}

