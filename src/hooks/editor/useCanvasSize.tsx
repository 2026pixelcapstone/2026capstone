import { toast } from "../../store/toastStore";
import { MAX_CANVAS_SIZE } from "../../constants/editor/editor";
import { CanvasState, FrameData } from "../../type/editor";
import { getCacheKey } from "../../utils/editorUtils";
import React, { useCallback, useEffect, useState } from "react";

interface UseCanvasSize{
    width: number;
    height: number;
    frame: FrameData[];
    setWithHistory: React.Dispatch<React.SetStateAction<CanvasState>>;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
    peekLayerCanvas: (cachekey: string) =>  HTMLCanvasElement | null
}

export function useCanvasSize({
    width,
    height,
    frame,
    setWithHistory,
    setUnsaved,
    peekLayerCanvas,
}: UseCanvasSize){
    const [customW, setCustomW] = useState(32);
    const [customH, setCustomH] = useState(32);
    const [isScaleImage, setIsScaleImage] = useState(false);

    // --------  state.width/height 변경 시 CustomW/H 동기화 -----------
    useEffect(() => {
        setCustomW(width);
        setCustomH(height);
    }, [width, height])

    const resizeLayer = useCallback(async (nextWidth: number, nextHeight: number, frameId: string, layerId: string, pixelData: string): Promise<string> => {
        let sourceCanvas: HTMLCanvasElement | HTMLImageElement | null = peekLayerCanvas(getCacheKey(frameId, layerId));
        
        if (!sourceCanvas && pixelData.trim()) {
            sourceCanvas = await new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('레이어 이미지를 불러오지 못했습니다.'));
                image.src = pixelData;
            });
        }
        // 캐시와 저장된 이미지가 모두 없으면 정상적인 빈 레이어입니다.
        if (!sourceCanvas) return '';
        // 그림을 임시 가상 캔버스에 백업
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = nextWidth;
        tempCanvas.height = nextHeight;

        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        if (!tempCtx){
            throw new Error('리사이즈용 캔버스를 생성하지 못했습니다.');
        }
        tempCtx.imageSmoothingEnabled = false;

        if(isScaleImage){
            tempCtx.drawImage(sourceCanvas, 0, 0, nextWidth, nextHeight);
        }else{
            const offsetX = Math.floor((nextWidth - sourceCanvas.width) / 2);
            const offsetY = Math.floor((nextHeight - sourceCanvas.height) / 2);
            tempCtx.drawImage(sourceCanvas, offsetX, offsetY);
        }
           
        const nextPixelData = tempCanvas.toDataURL('image/png');
        if (!nextPixelData.startsWith('data:image/png')) {
            throw new Error('리사이즈한 이미지를 저장하지 못했습니다.');
        }

        return nextPixelData;
    },[peekLayerCanvas, isScaleImage])

    // -------- 캔버스 크기 변경 -----------
    const applyCanvasSize = useCallback(async (w: number, h: number) => {
        if(width === w && height === h) return;

        try{
            if (!Number.isInteger(w) || !Number.isInteger(h) ||
                w < 1 || h < 1 || w > MAX_CANVAS_SIZE || h > MAX_CANVAS_SIZE) {
                throw new Error(`캔버스 크기는 1~${MAX_CANVAS_SIZE} 사이의 정수여야 합니다.`);
            }
            const resizeFrame = await Promise.all(
                frame.map(async frame => ({
                    ...frame,
                    layers: await Promise.all(
                        frame.layers.map(async layer => ({
                            ...layer,
                            pixelData: await resizeLayer(w, h, frame.id, layer.id, layer.pixelData),
                        }))
                    ),
                }))
            )
            setWithHistory((prev) => {
            return {
                ...prev,
                width: w,
                height: h,
                frames: resizeFrame,
            };
            })
            setUnsaved(true); // 서버 저장 여부
        }catch(err){
            toast.error(err instanceof Error ? err.message : '크기를 변경하지 못했습니다.');
        }
        
    }, [width, height, frame, resizeLayer, setWithHistory, setUnsaved]);

    return{customW, customH, isScaleImage, setCustomW, setCustomH, setIsScaleImage, applyCanvasSize}
}
