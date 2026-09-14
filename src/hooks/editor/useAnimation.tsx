// src/components/useAnimation.tsx
import { useCallback } from 'react';
import { createDefaultLayer} from '../../constants/editor/editor';
import {FrameData} from '../../type/editor'

interface UseAnimationProps{
    frames: FrameData[];
    currentFrameIdx: number;
    setWithHistory: React.Dispatch<React.SetStateAction<any>>;
    setCurrentFrameIdx: React.Dispatch<React.SetStateAction<number>>;
    setActiveLayer: React.Dispatch<React.SetStateAction<string | null>>;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAnimation({
    frames, 
    currentFrameIdx, 
    setWithHistory, 
    setCurrentFrameIdx,
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

        setCurrentFrameIdx(nextIdx);

        const targetActiveLayerId = targetFrame?.layers[0]?.id || null;

        if(targetActiveLayerId){
            setActiveLayer(targetActiveLayerId)
        }

        setWithHistory((prev: any) => ({
            ...prev, 
            frames: nextFrames
        }));

        setUnsaved(true);
    }, [frames, setWithHistory, setCurrentFrameIdx, setActiveLayer, setUnsaved]);
    
    /**
     * 특정 인덱스의 프레임을 삭제합니다.
     * 최소 1개의 프레임은 유지되어야 하며, 삭제 후 안전한 인덱스로 이동합니다.
     * index - 삭제할 프레임의 위치 인덱스
     */
    const deleteFrame = useCallback((index: number) => {
        if(frames.length <= 1) return;
        
        const nextFrames = frames.filter((_, i) => i !== index);
        const reorderedFrames = nextFrames.map((frame, idx) => ({
                ...frame,
                frameOrder: idx, // 삭제 후 순서 재정렬
            }));
        
        let nextIdx = currentFrameIdx; // 기본적으로 현재 프레임 인덱스 유지

        // 1. 현재 보고 있는 프레임 자체를 삭제한 경우
        if(currentFrameIdx === index){
            nextIdx = Math.min(currentFrameIdx, reorderedFrames.length - 1)
        }
        // 2. 현재 보고 있는 프레임 보다 '앞쪽' 프레임을 삭제한 경우
        else if(index < currentFrameIdx){
            nextIdx = currentFrameIdx - 1;
        }

        setCurrentFrameIdx(nextIdx);
        const targetFrame = reorderedFrames[nextIdx];
        
        let targetActiveLayerId : string | null = null;

        if(currentFrameIdx === index){
            targetActiveLayerId = targetFrame?.layers[0]?.id || null;
        }

        if(targetActiveLayerId){
            setActiveLayer(targetActiveLayerId)
        }

        setWithHistory((prev: any) => ({
            ...prev, 
            frames: reorderedFrames
        }));

        setUnsaved(true);
    }, [frames, setWithHistory, setCurrentFrameIdx, setActiveLayer, setUnsaved]);


    /**
     * 프레임을 재정렬합니다.
     */
    
    const reorderFrames = useCallback((frameStartIndex: number, frameEndIndex: number) => {
        if (frameStartIndex === frameEndIndex) return;
        
        setWithHistory((prev: any) => {
            const frames = prev.frames;
            if(!frames || !frames[frameStartIndex] || !frames[frameEndIndex]){
                return prev;
            }

            // 1. 현재 선택된 프레임의 ID 기억
            //const currentActiveFrameId = prev.frames[currentFrameIdx]?.id;
            
            // 2. 프레임 순서 재배치
            const nextFrames = [...frames];
            const [removed] = nextFrames.splice(frameStartIndex, 1);
            nextFrames.splice(frameEndIndex, 0, removed)

            // 3. 프레임 순서 변경에 따른 frameOrder 초기화
            const reorderedFrames = nextFrames.map((frame: FrameData, idx: Number) => ({
                ...frame,
                frameOrder: idx
            }));
            
            return {
                ...prev,
                frames: reorderedFrames,
            };
        });
        setUnsaved(true);
    }, [setWithHistory, setUnsaved]);

    return {addFrame, deleteFrame, reorderFrames};
}