import { useLayoutEffect, useState } from "react"
import {ZOOM_LEVELS} from "../../constants/editor/editor"
import { CanvasSize } from "../../type/editor";

export function useCanvasView(canvasSize: CanvasSize) {

    const getInitialZoomIdx = (size: CanvasSize) => {
        // 가로와 세로 중 더 긴 크기를 기준으로 판단
        const maxDimension = Math.max(size.width, size.height);

        if (maxDimension > 256) return 0; // 1배수
        if (maxDimension >= 256) return 1; // 2배수
        if (maxDimension >= 128) return 2; // 4배수
        if (maxDimension >= 64) return 3;  // 8배수
        if (maxDimension >= 32) return 5;  // 16배수
        return 6;                  // 20배수 이상
    };
    
    const [zoomIdx, setZoomIdx] = useState(() => getInitialZoomIdx(canvasSize));
    const zoom = ZOOM_LEVELS[Math.max(0, Math.min(zoomIdx, ZOOM_LEVELS.length - 1))];

    useLayoutEffect(() => {
        setZoomIdx(getInitialZoomIdx(canvasSize));
    }, [canvasSize.width, canvasSize.height]);

    return {zoom, setZoomIdx};
}