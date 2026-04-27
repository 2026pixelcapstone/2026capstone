import { useState } from "react";

interface Frame{
    id: number;
    data: string | null
    width: number;
    height: number;
}

export function useAnimation(size: {width: number; height: number}){
    // 초기 프레임
    const [frames, setFrames] = useState<Frame[]>([
        {
            id: Date.now(), 
            data: null,
            width: size.width,
            height: size.height
        }
    ]);
    const [currentFrameIdx, setCurrentFrameIdx] = useState(0);

    const addFrame = (currentSize: {width: number; height: number}, data: string | null = null) => {
        const newFrame: Frame = {
            id: Date.now(),
            data: data,
            width: currentSize.width,
            height: currentSize.height
        };
        setFrames(prev => [...prev, newFrame]); // 기존 배열 복사해서 완전 새로운 배열을 만든다
        setCurrentFrameIdx(prev => prev + 1); // 새 프레임은 항상 마지막에 유지
    };
    
    const deleteFrame = (index: number) => {
        setFrames(prev => {
            if(prev.length <= 1){
                return prev;
            }
            const newFrames = prev.filter((_, i) => i !== index);
            setCurrentFrameIdx(Math.min(index, newFrames.length - 1))
            return newFrames;
        });
    };

    return {frames, currentFrameIdx, setFrames, setCurrentFrameIdx, addFrame, deleteFrame};
}