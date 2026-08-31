// src/components/useAnimation.tsx
import { useCallback } from 'react';
import { createDefaultLayer} from '../../constants/editor/editor';
import {Frame} from '../../type/editorType'

interface UseAnimationProps{
    frames: Frame[];
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
     * currentSize - 현재 설정된 캔버스 너비와 높이
     * data - 복사할 이미지 데이터 (없으면 빈 프레임)
     */
    const addFrame = useCallback(() => {
        const newFrame: Frame = {
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

    const reorderFrames = useCallback((frameStartIndex: number, frameEndIndex: number) => {
        
    }, []);

    return {addFrame, deleteFrame, reorderFrames};
}