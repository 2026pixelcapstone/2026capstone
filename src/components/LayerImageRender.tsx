import { useEffect, useRef } from "react";
import { Image as KonvaImage } from 'react-konva';

interface LayerRendererProps{
    layerId: string;
    pixelData: string | null;
    canvasW: number;
    canvasH: number;
    currentFrameIdx: number;
    layerCanvasRefs: React.RefObject<Record<string, HTMLCanvasElement>>;
}

export const LayerImageRenderer = ({
  layerId,
  pixelData,
  canvasW,
  canvasH,
  currentFrameIdx,
  layerCanvasRefs
}: LayerRendererProps) => {
    const imageRef = useRef<any>(null);
    const cacheKey = `frame-${currentFrameIdx}_layer-${layerId}`;
    
    // 💡 [핵심 라이프사이클 격리]: 레이어가 처음 생겨나거나 서버에서 데이터가 로드될 때 
    // 내 메모리 도화지에 옛날 그림을 복원하는 책임을 이 컴포넌트가 온전히 짊어집니다.
    useEffect(() => {
        // 1. 메모리에 나만의 고유한 프레임_레이어 전용 캔버스가 없다면 생성
        if (!layerCanvasRefs.current[cacheKey]) {
            const canvas = document.createElement('canvas');
            canvas.width = canvasW;
            canvas.height = canvasH;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.imageSmoothingEnabled = false;
            layerCanvasRefs.current[cacheKey] = canvas;
        }
        const cachedCanvas = layerCanvasRefs.current[cacheKey];
        
        // 2. 만약 옛날 그림 데이터(pixelData)가 없다면 빈 도화지로 초기화
        if (!pixelData || !pixelData.trim()) {
            const ctx = cachedCanvas.getContext('2d');
            ctx?.clearRect(0, 0, canvasW, canvasH);
            imageRef.current?.getLayer()?.batchDraw();
            return;
        }

        // 3. 💡 순수한 Base64 문자열이므로 복잡한 JSON 파싱 없이 다이렉트로 복원 진행!
        const img = new Image();
        img.onload = () => {
            const ctx = cachedCanvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, canvasW, canvasH);
                ctx.drawImage(img, 0, 0);
                imageRef.current?.getLayer()?.batchDraw(); // 스크린에 버퍼 스왑
            }
        };
        img.src = pixelData;
    }, [layerId, pixelData, canvasW, canvasH, layerCanvasRefs])
    
    const myCanvas = layerCanvasRefs.current[cacheKey];
    if (!myCanvas) return null;
     return (
        <KonvaImage
            ref={imageRef}
            image={myCanvas}
            width={canvasW}
            height={canvasH}
            imageSmoothingEnabled={false}
            listening={false} // 마우스 이벤트가 바닥 레이어까지 뚫고 가도록 설정
        />
    );
}
