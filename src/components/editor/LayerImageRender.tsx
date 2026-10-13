import Konva from "konva";
import { getCacheKey } from "../../utils/editorUtils";
import { useLayoutEffect, useRef } from "react";
import { Image as KonvaImage } from 'react-konva';

interface LayerRendererProps {
    layerId: string;
    pixelData: string | null;
    canvasW: number;
    canvasH: number;
    currentFrameId: string | null;
    ensureLayerCanvas: (cacheKey: string) => HTMLCanvasElement;
    preparedCanvas?: HTMLCanvasElement;
}

// 각 레이어의 이미지를 렌더링하는 컴포넌트
export const LayerImageRenderer = ({
  layerId,
  pixelData,
  canvasW,
  canvasH,
  currentFrameId,
  ensureLayerCanvas,
  preparedCanvas,
}: LayerRendererProps) => {
    
    const imageRef = useRef<Konva.Image>(null);
    const cacheKey = currentFrameId ? getCacheKey(currentFrameId, layerId) : '';
    
    // 디코딩 중에는 이전 표시를 유지하고, 복원된 이미지와 크기를 함께 반영합니다.
    useLayoutEffect(() => {
        if (!cacheKey) return;
        let cancelled = false;

        const restore = (image: HTMLImageElement | HTMLCanvasElement | null) => {
            if (cancelled) return;
            const canvas = ensureLayerCanvas(cacheKey);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (image) ctx.drawImage(image, 0, 0);

            imageRef.current?.setAttrs({
                image: canvas,
                width: canvasW,
                height: canvasH,
            });
            // 다음 RAF까지 이전 Stage 내용을 남기지 않고 paint 전에 그립니다.
            imageRef.current?.getLayer()?.draw();
        };

        if (preparedCanvas) {
            restore(preparedCanvas);
            return () => { cancelled = true; };
        }

        if (!pixelData || !pixelData.trim()) {
            restore(null);
            return () => { cancelled = true; };
        }

        const img = new Image();
        img.onload = () => restore(img);
        img.src = pixelData;
        return () => {
            cancelled = true;
            img.onload = null;
        };
    }, [cacheKey, pixelData, canvasW, canvasH, ensureLayerCanvas, preparedCanvas]);

    if (!cacheKey) {
        return null;
    }

    return (
        <KonvaImage
            ref={imageRef}
            image={undefined}
            x={0}
            y={0}
            imageSmoothingEnabled={false}
            listening={false} // 마우스 이벤트가 바닥 레이어까지 뚫고 가도록 설정
        />
    );
};
