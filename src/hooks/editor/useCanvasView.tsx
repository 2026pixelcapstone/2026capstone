import { useState, useMemo } from "react"
import {ZOOM_LEVELS} from "../../constants/editor"


export function useCanvasView(initialW: number, initialH: number) {
    const [canvasW, setCanvasW] = useState(initialW);
    const [canvasH, setCanvasH] = useState(initialH);
    const [zoomIdx, setZoomIdx] = useState(6)
    
    // 뷰 상태
    const [isPanning, setIsPanning] = useState(false);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    
    const zoom = ZOOM_LEVELS[Math.max(0, Math.min(zoomIdx, ZOOM_LEVELS.length - 1))];
    const canvasStyle= useMemo(() => ({
        width: canvasW * zoom,
        height: canvasH * zoom,
        imageRendering: 'pixelated' as const,
        cursor: 'crosshair',
        display: 'block',
        backgroundColor: '#e8e8e8',
    }), [canvasW, canvasH, zoom]);
       
    return {canvasW, setCanvasW, canvasH, setCanvasH, zoom, setZoomIdx, canvasStyle};
}