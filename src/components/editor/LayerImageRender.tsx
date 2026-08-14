import { getCacheKey } from "../../utils/editorUtils";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Image as KonvaImage } from 'react-konva';

interface LayerRendererProps {
    layerId: string;
    pixelData: string | null;
    canvasW: number;
    canvasH: number;
    currentFrameIdx: number;
    layerCanvasRefs: React.RefObject<Record<string, HTMLCanvasElement>>;
    isScaleImage: boolean;
}

export const LayerImageRenderer = ({
  layerId,
  pixelData,
  canvasW,
  canvasH,
  currentFrameIdx,
  layerCanvasRefs,
  isScaleImage
}: LayerRendererProps) => {
    const imageRef = useRef<any>(null);
    const cacheKey = getCacheKey(currentFrameIdx, layerId);
    
   // 2. Side Effect(캔버스 생성 및 리사이징)를 useLayoutEffect로 완벽히 격리
    useLayoutEffect(() => {
        if (!layerCanvasRefs.current[cacheKey]) {
            const canvas = document.createElement('canvas');
            canvas.width = canvasW;
            canvas.height = canvasH;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.imageSmoothingEnabled = false;
        
            layerCanvasRefs.current[cacheKey] = canvas;
        } else {
            // 크기 변경 버튼을 눌러 canvasW/H가 바뀌었을 때 
            // 런타임에 멈춰있는 기존 가상 캔버스의 하드웨어 해상도 크기를 즉시 리사이징합니다!
            const existingCanvas = layerCanvasRefs.current[cacheKey];
            if (existingCanvas && (existingCanvas.width !== canvasW || existingCanvas.height !== canvasH)) {
                
                // 그림을 임시 가상 캔버스에 백업
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = existingCanvas.width;
                tempCanvas.height = existingCanvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) tempCtx.drawImage(existingCanvas, 0, 0);
                
                // 크기 리사이징(이 순간 기존 데이터 포멧)
                existingCanvas.width = canvasW;
                existingCanvas.height = canvasH;

                const ctx = existingCanvas.getContext('2d');
                if (ctx){ 
                    ctx.imageSmoothingEnabled = false;
                    if(isScaleImage){
                        // 옵션 A (그림도 함께 보정 확대): 새 도화지 크기(canvasW, canvasH)에 맞춘다.
                        ctx.drawImage(tempCanvas, 0, 0, canvasW, canvasH)
                    }
                    else{
                        // 옵션 B (그림 크기 고정): 백업 도화지의 원래 크기(tempCanvas.width/height)를 유지한다.
                        
                        const offsetX = (canvasW - tempCanvas.width) / 2;
                        const offsetY = (canvasH - tempCanvas.height) / 2;

                        ctx.drawImage(tempCanvas, offsetX, offsetY, tempCanvas.width, tempCanvas.height);
                    }
                }
            }
        }
    },[cacheKey, canvasW, canvasH, layerCanvasRefs, isScaleImage])
 

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
            ctx.clearRect(0, 0, cachedCanvas.width, cachedCanvas.height);
            imageRef.current?.getLayer()?.batchDraw();
            return;
        }

        // 순수한 Base64 문자열이므로 복잡한 JSON 파싱 없이 다이렉트로 복원 진행
        const img = new Image();
        img.onload = () => {
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, cachedCanvas.width, cachedCanvas.height);
            ctx.drawImage(img, 0, 0, img.width, img.height);
            
            imageRef.current?.getLayer()?.batchDraw(); // 스크린에 버퍼 스왑
        };
        img.src = pixelData;
    }, [cacheKey, pixelData, layerCanvasRefs])
    
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