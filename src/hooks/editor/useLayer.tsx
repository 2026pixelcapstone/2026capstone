import { CanvasState, FrameData, LayerData } from "../../type/editor";
import { useCallback, useRef } from "react";

interface UseLayersProps{
    frames: FrameData[];
    setWithHistory: React.Dispatch<React.SetStateAction<any>>;
    activeLayer: string | null;
    setActiveLayer: React.Dispatch<React.SetStateAction<string | null>>;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useLayers = ({
    frames,
    setWithHistory,
    activeLayer,
    setActiveLayer,
    setUnsaved,
}: UseLayersProps) => {

    // 프레임별 카운터를 맵 형태로 저장
    const layerCountersRef = useRef<Record<string, number>>({});
    
    // ── 레이어 추가 ───────────────────────────────────
    const addLayer = useCallback((targetFrameId: string | null) => {
        if(!targetFrameId){
            return;
        }
        const newLayerId = `layer-${crypto.randomUUID().slice(0, 8)}`;
        
        if(!layerCountersRef.current[targetFrameId]){
            layerCountersRef.current[targetFrameId] = 2;
        }

        const currentLayerCount = layerCountersRef.current[targetFrameId];
        layerCountersRef.current[targetFrameId] += 1;

        setWithHistory((prev: any) => {
            const updatedFrames = prev.frames.map((frame: FrameData) => {
                if(frame.id !== targetFrameId) return frame; // 타깃 프레임이 아니면 패스
                
                const newLayer: LayerData = {
                    id: newLayerId,
                    name: `Layer ${currentLayerCount}`,
                    layerOrder: frame.layers.length, // 현재 프레임의 레이어 개수를 기준으로 순서 부여
                    blendMode: 'NORMAL',
                    isLocked: false,
                    isVisible: true,
                    opacity: 100, // 0~100 스케일 통일
                    color: '#818cf8',
                    pixelData: '', // 새 레이어니까 도화지는 깨끗하게 빈 값
                };
                return{...frame, layers: [...frame.layers, newLayer]};
            });
            return { ...prev, frames: updatedFrames };
        })
        setActiveLayer(newLayerId); // 생성 직후 방금 만든 레이어를 활성화
    }, [setWithHistory, setActiveLayer]);

    // ── 레이어 삭제 ───────────────────────────────────
    const deleteLayer = useCallback((targetFrameId: string | null, layerIdToDelete: string | null) => {
        if(!targetFrameId || !layerIdToDelete) return;

        const targetFrame = frames.find((f: FrameData) => f.id === targetFrameId);
        if(!targetFrame || !targetFrame.layers) return;        

        // 최소 1개 레이어 유지 조건 방어
        if(targetFrame.layers.length <= 1){
            return;
        }
        // 레이어 네이밍 카운터 롤백
        const layerToSubtract = targetFrame.layers.find((l: LayerData) => l.id === layerIdToDelete);
        if(layerToSubtract && layerToSubtract.name.startsWith("Layer ")){
            const layerNum = parseInt(layerToSubtract.name.replace("Layer ", ""), 10); // 10: 10진수로 읽으라고 지정
            const currentCounter = layerCountersRef.current[targetFrameId] || 2;
            
            if (layerNum === currentCounter - 1) {
                // 삭제한 레이어가 가장 마지막 번호였다면 번호 재활용
                layerCountersRef.current[targetFrameId] = Math.max(2, currentCounter - 1);
            }
        }
        setWithHistory((prev: CanvasState) => {
            const updatedFrames = prev.frames.map((frame: FrameData) => {
                if( frame.id !== targetFrameId) return frame;

                // 해당 프레임 내부에서 지정된 레이어만 필터링
                const remainingLayers = frame.layers.filter((layer: LayerData) => layer.id !== layerIdToDelete);
                
                // 레이어가 순서대로 정렬되도록 레이어 오더 재정렬(Optional)
                const reorderedLayers = remainingLayers.map((layer: LayerData, idx: number) => ({
                    ...layer,
                    layerOrder: idx
                }));
                return { ...frame, layers: reorderedLayers };
            });
            return { ...prev, frames: updatedFrames };
        });

        // 만약 지운 레이어가 내가 칠하고 있던 레이어였다면 타깃 재조정
        if (activeLayer === layerIdToDelete) {
            const remainingLayers = targetFrame.layers.filter((layer: any) => layer.id !== layerIdToDelete);
            const nextActiveId = remainingLayers[remainingLayers.length - 1]?.id || null;
            setActiveLayer(nextActiveId);
        }
        setUnsaved(true);
    }, [frames, activeLayer, setWithHistory, setActiveLayer]);

    // ── 레이어 눈 켜기/끄기 ───────────────────────────────────
    const toggleVisibility = useCallback((targetFrameId: string | null, layerId: string | null) => {
        if(!targetFrameId || !layerId) return;

        setWithHistory((prev: CanvasState) => {
            const updatedFrames = prev.frames.map((frame: FrameData) => {
                if (frame.id !== targetFrameId) return frame;
                
                const updatedLayers = frame.layers.map((layer: any) =>
                    layer.id === layerId ? { ...layer, isVisible: !layer.isVisible } : layer
                );
                return { ...frame, layers: updatedLayers };
            });
            return { ...prev, frames: updatedFrames };
        });
    }, [setWithHistory]);
    
    // ── 레이어의 순서 바꾸기 ───────────────────────────────────
    const reorderLayers = useCallback((targetFrameId: string | null, layerStartIndex: number , layerEndIndex: number) => {
        if(!targetFrameId) return;
        
        setWithHistory((prev: CanvasState) => {
            const updatedFrames = prev.frames.map((frame: FrameData) => {
                if (frame.id !== targetFrameId) return frame;

                const newLayers = [...frame.layers];

                const [removed] = newLayers.splice(layerStartIndex, 1);
                newLayers.splice(layerEndIndex, 0, removed);

                const reorderedLayers = newLayers.map((layer: LayerData, idx: number) =>({
                    ...layer,
                    layerOrder: idx,
                }));

                return { ...frame, layers: reorderedLayers};
            });
            return { ...prev, frames: updatedFrames };
        })
    },[setWithHistory])
    
    return { addLayer, deleteLayer, toggleVisibility, layerCountersRef, reorderLayers};
}