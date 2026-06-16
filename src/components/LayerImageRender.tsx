import { getCacheKey } from "../utils/editorUtils";
import { useEffect, useRef } from "react";
import { Image as KonvaImage } from 'react-konva';

interface LayerRendererProps {
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
    const cacheKey = getCacheKey(currentFrameIdx, layerId);
    
    // 💡 [구조적 안정성 및 크기 동기화 강화]:
    // 메모리에 내 상자가 없다면 즉시 생성하고, 이미 존재하더라도 크기가 바뀌었다면 
    // "동기적"으로 캔버스의 실제 해상도를 즉시 최신 크기(canvasW, canvasH)로 동기화합니다.
    if (!layerCanvasRefs.current[cacheKey]) {
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.imageSmoothingEnabled = false;
        
        layerCanvasRefs.current[cacheKey] = canvas;
    } else {
        // 🌟 [초특급 중요]: 크기 변경 버튼을 눌러 canvasW/H가 바뀌었을 때 
        // 런타임에 멈춰있는 기존 가상 캔버스의 하드웨어 해상도 크기를 즉시 리사이징합니다!
        const existingCanvas = layerCanvasRefs.current[cacheKey];
        if (existingCanvas && (existingCanvas.width !== canvasW || existingCanvas.height !== canvasH)) {
            existingCanvas.width = canvasW;
            existingCanvas.height = canvasH;
            const ctx = existingCanvas.getContext('2d');
            if (ctx) ctx.imageSmoothingEnabled = false;
        }
    }

    // 옛날 이미지 복원은 비동기 영역인 useEffect에서 차분히 수행합니다.
    useEffect(() => {
        const cachedCanvas = layerCanvasRefs.current[cacheKey];
        if (!cachedCanvas) return;

        const ctx = cachedCanvas.getContext('2d');
        if (!ctx) return;
        
        // 어떤 상황에서도 브라우저 필터가 켜지지 않도록 쐐기 박기
        ctx.imageSmoothingEnabled = false;

        // 만약 옛날 그림 데이터(pixelData)가 없다면 빈 도화지로 깨끗하게 초기화
        if (!pixelData || !pixelData.trim()) {
            ctx.clearRect(0, 0, canvasW, canvasH);
            imageRef.current?.getLayer()?.batchDraw();
            return;
        }

        // 순수한 Base64 문자열이므로 복잡한 JSON 파싱 없이 다이렉트로 복원 진행
        const img = new Image();
        img.onload = () => {
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvasW, canvasH);
            
            // 🌟 [핵심 수정]: 단순 (0,0) 드로우 대신, 
            // 현재 타깃 캔버스의 전체 규격(canvasW, canvasH)에 완전히 들어맞도록 
            // 가로세로 스케일 크기를 명시해서 구워줍니다. 이래야 불러왔을 때 공중 부양이 박멸됩니다!
            ctx.drawImage(img, 0, 0, canvasW, canvasH);
            
            imageRef.current?.getLayer()?.batchDraw(); // 스크린에 버퍼 스왑
        };
        img.src = pixelData;
    }, [cacheKey, pixelData, canvasW, canvasH, layerCanvasRefs])
    
    const myCanvas = layerCanvasRefs.current[cacheKey];

    return (
        <KonvaImage
            ref={imageRef}
            image={myCanvas}
            x={0}
            y={0}
            width={canvasW}
            height={canvasH}
            imageSmoothingEnabled={false}
            listening={false} // 마우스 이벤트가 바닥 레이어까지 뚫고 가도록 설정
        />
    );
};