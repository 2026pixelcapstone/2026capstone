import { createDefaultLayer } from "../../constants/editor";
import { LayerData } from "../../constants/editorType";
import { useCallback, useRef, useState } from "react";

export const useLayers = (
    state: { frames: any[]; currentFrameIdx: number },
    setWithHistory: React.Dispatch<React.SetStateAction<any>>,
    activeLayer: string | null,
    setActiveLayer: React.Dispatch<React.SetStateAction<string | null>>
) => {
   
    const layerCounter = useRef(2);
    
    // ── 레이어 추가 ───────────────────────────────────
    const addLayer = useCallback((frameIdx: number) => {
        const newLayerId = `layer-${crypto.randomUUID().slice(0, 8)}`;
        const currentLayerCount = layerCounter.current;
        layerCounter.current += 1;

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

                return{...frame, layers: [frame.layers, newLayer]};
            });
            return { ...prev, frames: updatedFrames };
        })
        setActiveLayer(newLayerId);
    }, [setWithHistory, setActiveLayer]);

    // ── 레이어 삭제 ───────────────────────────────────
    const deleteLayer = useCallback((frameIdx: number, layerIdToDelete: string | null) => {
        if(!layerIdToDelete) return;

        const targetFrame = state.frames[frameIdx];
        if(!targetFrame) return;

        if(targetFrame.layer.length <= 1){
            alert("최소 하나의 레이어는 존재해야 합니다");
        }

        setWithHistory((prev: any) => {
            const updatedFrames = prev.frame.map((frame: any, fIdx: number) => {
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

    return { addLayer, deleteLayer, toggleVisibility, layerCounter};
}