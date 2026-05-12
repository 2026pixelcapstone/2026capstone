import { useState } from "react"
import {ZOOM_LEVELS} from "../constants/editor"


export function useCanvasView(initialW: number, initialH: number) {
    const [canvasW, setCanvasW] = useState(initialW);
    const [canvasH, setCanvasH] = useState(initialH);
    const [zoomIdx, setZoomIdx] = useState(6)
    
    const zoom = ZOOM_LEVELS[zoomIdx];
    const canvasStyle={
        width: canvasW * zoom,
        height: canvasH * zoom,
        imageRendering: 'pixelated' as const,
        cursor: 'crosshair',
        display: 'block',
        backgroundColor: '#e8e8e8',   // 캔버스 배경: 연회색
    };

    return {canvasW, setCanvasW, canvasH, setCanvasH, zoom, setZoomIdx, canvasStyle};
}