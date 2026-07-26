import { LayerData } from "../../constants/editorType";
import { useCallback, useRef } from "react";

export const useLayers = (
    state: { frames: any[]; },
    setWithHistory: React.Dispatch<React.SetStateAction<any>>,
    activeLayer: string | null,
    setActiveLayer: React.Dispatch<React.SetStateAction<string | null>>
) => {

    // 프레임별 카운터를 맵 형태로 저장
    const layerCountersRef = useRef<Record<number, number>>({});
    
    // ── 레이어 추가 ───────────────────────────────────
    const addLayer = useCallback((frameIdx: number) => {
        const newLayerId = `layer-${crypto.randomUUID().slice(0, 8)}`;
        
        if(!layerCountersRef.current[frameIdx]){
            layerCountersRef.current[frameIdx] = 2;
        }

        const currentLayerCount = layerCountersRef.current[frameIdx];
        layerCountersRef.current[frameIdx] += 1;

        setWithHistory((prev: any) => {
            const updatedFrames = prev.frames.map((frame: any, fIdx: number) => {
                if(fIdx !== frameIdx) return frame; // 타깃 프레임이 아니면 패스
                
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
        setActiveLayer(newLayerId); // 사용 이유: 
    }, [setWithHistory, setActiveLayer]);

    // ── 레이어 삭제 ───────────────────────────────────
    const deleteLayer = useCallback((frameIdx: number, layerIdToDelete: string | null) => {
        if(!layerIdToDelete) return;

        const targetFrame = state.frames[frameIdx];
        if(!targetFrame || !targetFrame.layers) return;

        if(targetFrame.layers.length <= 1){
            alert("최소 하나의 레이어는 존재해야 합니다");
            return;
        }

        const layerToSubtract = targetFrame.layers.find((l: any) => l.id === layerIdToDelete);
        if(layerToSubtract && layerToSubtract.name.startsWith("Layer ")){
            const layerNum = parseInt(layerToSubtract.name.replace("Layer ", ""), 10); // 10: 10진수로 읽으라고 지정
            const currentCounter = layerCountersRef.current[frameIdx] || 2;
            
            if (layerNum === currentCounter - 1) {
                // 카운터를 1 줄여서, 다음에 레이어를 만들 때 이 번호를 다시 재활용하게 만듭니다.
                layerCountersRef.current[frameIdx] = Math.max(2, currentCounter - 1);
            }
        }
        setWithHistory((prev: any) => {
            const updatedFrames = prev.frames.map((frame: any, fIdx: number) => {
                if(fIdx !== frameIdx) return frame;

                // 해당 프레임 내부에서 지정된 레이어만 필터링
                const remainingLayers = frame.layers.filter((layer: any) => layer.id !== layerIdToDelete);
                
                // 레이어가 순서대로 정렬되도록 레이어 오더 재정렬(Optional)
                const reorderedLayers = remainingLayers.map((layer: any, idx: number) => ({
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
    }, [state.frames, activeLayer, setWithHistory, setActiveLayer]);

    // ── 레이어 눈 켜기/끄기 ───────────────────────────────────
    const toggleVisibility = useCallback((frameIdx: number, layerId: string) => {
        setWithHistory((prev: any) => {
            const updatedFrames = prev.frames.map((frame: any, fIdx: number) => {
                if (fIdx !== frameIdx) return frame;
                
                const updatedLayers = frame.layers.map((layer: any) =>
                    layer.id === layerId ? { ...layer, isVisible: !layer.isVisible } : layer
                );
                return { ...frame, layers: updatedLayers };
            });
            return { ...prev, frames: updatedFrames };
        });
    }, [setWithHistory]);
    
    // ── 레이어의 순서 바꾸기 ───────────────────────────────────
    const reorderLayers = useCallback((layerStartIndex: number , layerEndIndex: number) => {
        
        setWithHistory((prev: any) => {
            const currentFrameIdx = prev.currentFrameIdx;

            const updatedFrames = prev.frames.map((frame: any, fIdx: number) => {
                if (fIdx !== currentFrameIdx) return frame;

                const newLayers = [...frame.layers];

                /* splice: 지정 수가 0이면 아무것도 잘라내기 하지 않음. 
                시작 위치부터 카운트하여 카운트 수 만큼 뒤에 있는 인덱스까지 잘라내기
                (지정 수가 배열 길이 - start 보다 클 때는 start 뒤의 배열 전체 삭제)*/
                const [removed] = newLayers.splice(layerStartIndex, 1);
                newLayers.splice(layerEndIndex, 0, removed);

                const reorderedLayers = newLayers.map((layer: LayerData, idx: number) =>({
                    ...layer,
                    layerOrder: idx,
                }));

                console.log("② [변경 후] 레이어 순서:", reorderedLayers.map((l: any) => l.name));
                return { ...frame, layers: reorderedLayers};
            });
            return { ...prev, frames: updatedFrames };
        })
       
    },[setWithHistory])
    
    return { addLayer, deleteLayer, toggleVisibility, layerCountersRef, reorderLayers};
}