import Konva from "konva";
import { getCacheKey } from "../../utils/editorUtils";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Image as KonvaImage } from 'react-konva';

interface LayerRendererProps {
    layerId: string;
    pixelData: string | null;
    canvasW: number;
    canvasH: number;
    currentFrameId: string | null;
    ensureLayerCanvas: (cacheKey: string) => HTMLCanvasElement;
    peekLayerCanvas: (cacheKey: string) => HTMLCanvasElement | null;
    isScaleImage: boolean;
}

// 각 레이어의 이미지를 렌더링하는 컴포넌트
export const LayerImageRenderer = ({
  layerId,
  pixelData,
  canvasW,
  canvasH,
  currentFrameId,
  ensureLayerCanvas,
  peekLayerCanvas,
  isScaleImage
}: LayerRendererProps) => {
    
    const imageRef = useRef<Konva.Image>(null);

    const cacheKey = currentFrameId ? getCacheKey(currentFrameId, layerId) : '';
    
    // 2. Side Effect(캔버스 생성 및 리사이징)를 useLayoutEffect로 완벽히 격리
    useLayoutEffect(() => {
        if (!cacheKey) return;
        const existingCanvas = peekLayerCanvas(cacheKey);
        let canvas: HTMLCanvasElement;
        if (!existingCanvas) {           
            canvas = ensureLayerCanvas(cacheKey);
        } else {
            canvas = existingCanvas;
            // 크기 변경 버튼을 눌러 canvasW/H가 바뀌었을 때 
            // 런타임에 멈춰있는 기존 가상 캔버스의 하드웨어 해상도 크기를 즉시 리사이징합니다!
            // 훅으로 리사이즈 정책을 옮기기 전까지 확대/가운데 정렬을 여기서 유지합니다.
            if (existingCanvas.width !== canvasW || existingCanvas.height !== canvasH) {
                
                // 그림을 임시 가상 캔버스에 백업
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = existingCanvas.width;
                tempCanvas.height = existingCanvas.height;
                const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                if (tempCtx) tempCtx.drawImage(existingCanvas, 0, 0);
                
                // 크기 리사이징(이 순간 기존 데이터 포멧)
                existingCanvas.width = canvasW;
                existingCanvas.height = canvasH;

                const ctx = existingCanvas.getContext('2d', { willReadFrequently: true });
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
        imageRef.current?.image(canvas);
        imageRef.current?.getLayer()?.batchDraw();
    },[cacheKey, canvasW, canvasH, peekLayerCanvas, ensureLayerCanvas, isScaleImage])
 

    // 옛날 이미지 복원은 비동기 영역인 useEffect에서 차분히 수행합니다.
    useEffect(() => {
        if (!cacheKey) return;
        
        const cachedCanvas = peekLayerCanvas(cacheKey);
        if (!cachedCanvas) return;

        const ctx = cachedCanvas.getContext('2d', { willReadFrequently: true });
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
        let cancelled = false;
        img.onload = () => {
            if (cancelled || peekLayerCanvas(cacheKey) !== cachedCanvas) return;
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, cachedCanvas.width, cachedCanvas.height);
            ctx.drawImage(img, 0, 0, img.width, img.height);
            
            imageRef.current?.getLayer()?.batchDraw(); // 스크린에 버퍼 스왑
        };
        img.src = pixelData;
        return () => {
            cancelled = true;
            img.onload = null;
        };
    }, [cacheKey, pixelData, peekLayerCanvas])
    
    if (!cacheKey) {
        return null;
    }

    return (
        <KonvaImage
            ref={imageRef}
            image={undefined}
            x={0}
            y={0}
            width={canvasW}
            height={canvasH}
            imageSmoothingEnabled={false}
            listening={false} // 마우스 이벤트가 바닥 레이어까지 뚫고 가도록 설정
        />
    );
};
