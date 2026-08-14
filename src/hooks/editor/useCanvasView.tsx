import { useState } from "react"
import {ZOOM_LEVELS} from "../../constants/editor/editor"

export function useCanvasView() {
    const [zoomIdx, setZoomIdx] = useState(6);
    
    const zoom = ZOOM_LEVELS[Math.max(0, Math.min(zoomIdx, ZOOM_LEVELS.length - 1))];
    
    return {zoom, setZoomIdx};
}