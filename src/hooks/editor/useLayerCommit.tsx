import { getCacheKey, getLayerImageData } from "../../utils/editorUtils";
import { CanvasState } from "../../type/editor";
import { useCallback } from "react";

interface UseLayerCommitProps {
  activeFrameId: string | null;
  activeLayerId: string | null;
  peekLayerCanvas: (cacheKey: string) => HTMLCanvasElement | null;
  setWithHistory: React.Dispatch<React.SetStateAction<CanvasState>>;
}

export function useLayerCommit({
    activeFrameId,
    activeLayerId,
    peekLayerCanvas,
    setWithHistory,
}: UseLayerCommitProps) {
    // ── 레이어 변경 내역 저장 ───────────────────────────────────
    /**
     * 현재 캔버스의 내용을 이미지 데이터(Base64)로 변환하여 해당 프레임에 저장합니다.
     * setWithHistory -> useHistory 기록용
     */
    const commitLayerChanges = useCallback((capturedFrameId = activeFrameId, capturedLayerId = activeLayerId) => {
        if(!capturedFrameId || !capturedLayerId) return;

        // [핵심 수정]: 마우스를 뗄 때도 현재 지목된 고유한 프레임_레이어 상자에서 그림을 도려냅니다.
        const cacheKey = getCacheKey(capturedFrameId, capturedLayerId);
        const cachedCanvas = peekLayerCanvas(cacheKey);
        if (!cachedCanvas) return;

        // 최적화 수정: 무겁고 잔상이 남을 수 있는 Node.toCanvas() 대신 
        // 우리가 실시간으로 낙서하던 진짜 가상 오프스크린 캔버스 캐시에서 직접 순수 PNG 소스를 추출합니다.
        const layerImageData = getLayerImageData(cachedCanvas);

        setWithHistory((prev) => {
            // 1. 해당 ID를 가진 프레임이 실제로 존재하는지 확인 (무결성 검사)
            const targetFrameExists = prev.frames.some((frame) => frame.id == capturedFrameId)
            if(!targetFrameExists) return prev;
            
            // 2. frame.id 기준으로 타깃 프레임 및 내부 레이어 갱신
            const updatedFrames = prev.frames.map((frame) =>{
                if (frame.id !== capturedFrameId) return frame;

                const updateLayers = frame.layers.map((layer) => {
                    if(layer.id !== capturedLayerId) return layer;
                    return {...layer, pixelData: layerImageData};
                });
                return {...frame, layers: updateLayers}
            });
        
            return {
                ...prev,
                frames: updatedFrames,
            };
        });
    }, [activeFrameId, activeLayerId, setWithHistory, peekLayerCanvas]);

    return { commitLayerChanges };
}