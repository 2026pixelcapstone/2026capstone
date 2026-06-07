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
    
    // 💡 [구조적 안정성 강화]: useEffect를 기다리지 않고, 렌더링 로직이 시작되자마자 
    // 메모리에 내 상자가 없다면 "동기적"으로 즉시 캔버스를 만들어 버립니다
    if (!layerCanvasRefs.current[cacheKey]) {
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.imageSmoothingEnabled = false;
        layerCanvasRefs.current[cacheKey] = canvas;
    }

    // 옛날 이미지 복원은 비동기 영역인 useEffect에서 차분히 수행합니다.
    useEffect(() => {
        const cachedCanvas = layerCanvasRefs.current[cacheKey];
        
        // 만약 옛날 그림 데이터(pixelData)가 없다면 빈 도화지로 초기화
        if (!cachedCanvas || !pixelData || !pixelData.trim()) {
            const ctx = cachedCanvas.getContext('2d');
            ctx?.clearRect(0, 0, canvasW, canvasH);
            imageRef.current?.getLayer()?.batchDraw();
            return;
        }

        // 순수한 Base64 문자열이므로 복잡한 JSON 파싱 없이 다이렉트로 복원 진행
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
