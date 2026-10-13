import { getCacheKey } from "../../utils/editorUtils";
import { FrameData } from "../../type/editor";
import { useCallback, useEffect, useRef } from "react";

interface UseLayerCanvasProps {
  frames: FrameData[];
  width: number;
  height: number;
}

export function useLayerCanvas({
    frames,
    width,
    height,
}: UseLayerCanvasProps) {
    const layerCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({})

    // -------- 캐시 캔버스 유실을 막는 역할을 함(청소부) -----------
    useEffect(() => {
        const liveCacheKeys = new Set<string>();
        frames.forEach((frame) => {
            frame.layers.forEach((layer) => {
            liveCacheKeys.add(getCacheKey(frame.id, layer.id));
            });
        });

        Object.keys(layerCanvasRefs.current).forEach((cacheKey) => {
            if (!liveCacheKeys.has(cacheKey)) {
            delete layerCanvasRefs.current[cacheKey]
            }
        })
    }, [frames]);
    
    //-------- 레이어 캔버스 보장 -----------
    const ensureLayerCanvas = useCallback((cacheKey: string) =>{
        const existingCanvas = layerCanvasRefs.current[cacheKey];
    
        // 1. 이미 메모리에 존재하고 규격(크기)이 맞다면 기존 도화지 즉시 재사용
        if (
          existingCanvas &&
          existingCanvas.width === width &&
          existingCanvas.height === height
        ) {
          return existingCanvas;
        }
    
        // 2. 크기가 바뀌었거나 아예 처음 만든 방이라면 메모리에 가상 도화지 새로 생성
        const nextCanvas = document.createElement('canvas')
        nextCanvas.width = width;
        nextCanvas.height = height;
    
        const ctx = nextCanvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.imageSmoothingEnabled = false; // 픽셀아트 흐림 방지
          
          // 크기 조절 등으로 인해 기존 도화지를 복사해야 하는 상황
          if (existingCanvas) {
            ctx.drawImage(existingCanvas, 0, 0, existingCanvas.width, existingCanvas.height);
          }
        }
        layerCanvasRefs.current[cacheKey] = nextCanvas;
        return nextCanvas;
    }, [width, height])

    // ------- 레이어 캔버스 조회 -----------
    const peekLayerCanvas = useCallback((cacheKey: string) => {
        const canvas = layerCanvasRefs.current[cacheKey];
        if (!canvas) return null;
        // 리사이즈 전의 캐시 대신 최신 pixelData를 사용하도록 합니다.
        if (canvas.width !== width || canvas.height !== height) {
            delete layerCanvasRefs.current[cacheKey];
            return null;
        }
        return canvas;
    }, [width, height])

    // ------- 레이어 캔버스 삭제 -----------
    const clearLayerCanvas = useCallback((cacheKey: string) => {
        delete layerCanvasRefs.current[cacheKey];
    }, [layerCanvasRefs])

    // ------- 모든 레이어 캔버스 삭제 -----------
    const clearAllLayerCanvas = useCallback(() => {
        if(layerCanvasRefs && layerCanvasRefs.current) {
            layerCanvasRefs.current = {};
        }
    }, [layerCanvasRefs])
    return { ensureLayerCanvas, peekLayerCanvas, clearLayerCanvas, clearAllLayerCanvas }
}
