// src/components/useAnimation.tsx
import { useState } from "react";
import {Frame} from '../constants/type'

interface UseAnimationProps{
    frames: Frame[];
    currentFrameIdx: number;
    // 상태 변경 시 부모의 setWithHistory를 실행해줄 콜백
    onChange: (newFrames: Frame[], nextIdx: number) => void
}

export function useAnimation({frames, currentFrameIdx, onChange}: UseAnimationProps){
    // 초기 프레임
    /*
    const [frames, setFrames] = useState<Frame[]>([
        {
            id: crypto.randomUUID(), 
            data: null,
            width: size.width,
            height: size.height
        }
    ]);
    const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
    */

    /**
     * 새로운 프레임을 생성하고 리스트에 추가합니다.
     * @param {Object} currentSize - 현재 설정된 캔버스 너비와 높이
     * @param {string | null} data - 복사할 이미지 데이터 (없으면 빈 프레임)
     */

    const addFrame = (currentSize: {width: number; height: number}, data: string | null = null) => {
        const newFrame: Frame = {
            id: crypto.randomUUID(),
            data: data,
            width: currentSize.width,
            height: currentSize.height
        };
        const nextFrames = [...frames, newFrame];
        onChange(nextFrames, nextFrames.length - 1)
        /*
        setFrames(prev => {
            const nextFrames = [...prev, newFrame];
            setCurrentFrameIdx(nextFrames.length - 1);
            return nextFrames;
        })*/
    };
    
    /**
     * 특정 인덱스의 프레임을 삭제합니다.
     * 최소 1개의 프레임은 유지되어야 하며, 삭제 후 안전한 인덱스로 이동합니다.
     * @param {number} index - 삭제할 프레임의 위치 인덱스
     */
    const deleteFrame = (index: number) => {
        if(frames.length <= 1) return;

        const nextFrames = frames.filter((_, i) => i !== index);
        const nextIdx = Math.max(0, Math.min(index, nextFrames.length - 1));

        onChange(nextFrames, nextIdx);
        /*
        setFrames(prev => {
            if(prev.length <= 1){
                return prev;
            }
            const newFrames = prev.filter((_, i) => i !== index);
            setCurrentFrameIdx(Math.min(index, newFrames.length - 1))
            return newFrames;
        });*/
    };

    return {addFrame, deleteFrame};
}