// src/components/useAnimation.tsx
import { useCallback } from 'react';
import { createDefaultLayer} from '../../constants/editor/editor';
import {CanvasState, FrameData} from '../../type/editor'

interface UseAnimationProps{
    frames: FrameData[];
    activeFrameId: string | null;
    setWithHistory: React.Dispatch<React.SetStateAction<any>>;
    setActiveFrameId: React.Dispatch<React.SetStateAction<string | null>>;
    setActiveLayer: React.Dispatch<React.SetStateAction<string | null>>;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAnimation({
    frames, 
    activeFrameId,
    setWithHistory, 
    setActiveFrameId,
    setActiveLayer,
    setUnsaved,
}: UseAnimationProps){
    /**
     * 새로운 프레임을 생성하고 리스트에 추가합니다.
     */
    const addFrame = useCallback(() => {
        const newFrame: FrameData = {
            id: `frame-${crypto.randomUUID()}`,
            frameOrder: frames.length, // 새 프레임은 현재 개수 기준으로 순서 부여
            layers: [createDefaultLayer()],
        };
        const nextFrames = [...frames, newFrame];

        const nextIdx = nextFrames.length - 1;
        const targetFrame = nextFrames[nextIdx];

        setActiveFrameId(targetFrame.id)

        const targetActiveLayerId = targetFrame?.layers[0]?.id || null;

        if(targetActiveLayerId){
            setActiveLayer(targetActiveLayerId)
        }

        setWithHistory((prev: any) => ({
            ...prev, 
            frames: nextFrames
        }));

        setUnsaved(true);
    }, [frames, setActiveFrameId, setWithHistory, setActiveLayer, setUnsaved]);
    
    /**
     * 특정 인덱스의 프레임을 삭제합니다.
     * 최소 1개의 프레임은 유지되어야 하며, 삭제 후 안전한 인덱스로 이동합니다.
     * index - 삭제할 프레임의 위치 인덱스
     */
    const deleteFrame = useCallback((frameIdToDelete: string) => {
        if(frames.length <= 1) return;
        
        // 삭제할 프레임의 위치 파악
        const targetIdx = frames.findIndex((f) => f.id === frameIdToDelete);
        if(targetIdx < 0){
            return;
        }

        // 프레임 제거 및 frameOrder 재정렬
        const nextFrames = frames.filter((frame) => frame.id !== frameIdToDelete)
            .map((frame, idx) =>({
                ...frame,
                frameOrder: idx,
            }));
        
        // 지운 프레임이 현재 활성 프레임(activeFrameId)이었을 경우의 타깃 재조정
        if(activeFrameId === frameIdToDelete){
            // 삭제된 자리 또는 마지막 프레임 선택
            const safeIdx = Math.min(targetIdx, nextFrames.length - 1);
            const nextActiveFrame = nextFrames[safeIdx];

            if(nextActiveFrame){
                setActiveFrameId(nextActiveFrame.id);
                setActiveLayer(nextActiveFrame.layers[0]?.id || null);
            }
        }

        setWithHistory((prev: any) => ({
            ...prev, 
            frames: nextFrames,
        }));

        setUnsaved(true);
    }, [frames, activeFrameId, setWithHistory, setActiveLayer, setUnsaved]);


    /**
     * 프레임을 재정렬합니다.
     */
    const reorderFrames = useCallback((frameStartIndex: number, frameEndIndex: number) => {
        if (frameStartIndex === frameEndIndex) return;
        
        const currentFrames = frames;
        
        const movedFrame = currentFrames[frameStartIndex];
        const targetSlotFrame = currentFrames[frameEndIndex];

        if(!movedFrame || !targetSlotFrame){
            return;
        }
        
        // 배열 순서 재배치
        const nextFrames = [...currentFrames];
        const [removed] = nextFrames.splice(frameStartIndex, 1);
        nextFrames.splice(frameEndIndex, 0, removed);

        // 순서(frameOrder) 재정렬
        const reorderedFrames = nextFrames.map((frame: FrameData, idx: number) => ({
            ...frame,
            frameOrder: idx,
        }));

        setWithHistory((prev: CanvasState) => {
            return {
                ...prev,
                frames: reorderedFrames,
            };
        });
       
        setUnsaved(true);
    }, [frames, setWithHistory, setUnsaved]);

    return {addFrame, deleteFrame, reorderFrames};
}