import { useState, useMemo } from "react"
import {ZOOM_LEVELS} from "../../constants/editor"

export function useCanvasView(width: number, height: number) {
    const [zoomIdx, setZoomIdx] = useState(6)
    
    const zoom = ZOOM_LEVELS[Math.max(0, Math.min(zoomIdx, ZOOM_LEVELS.length - 1))];
    
    const canvasStyle= useMemo(() => ({
        width: width * zoom,
        height: height * zoom,
        imageRendering: 'pixelated' as const,
        cursor: 'crosshair',
        display: 'block',
        backgroundColor: '#e8e8e8',
    }), [width, height, zoom]);
       
    return {zoom, setZoomIdx, canvasStyle};
}