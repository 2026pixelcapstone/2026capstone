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
            data: null,
            width: currentSize.width,
            height: currentSize.height
        };
        setFrames(prev => {
            const nextFrames = [...prev, newFrame];
            setCurrentFrameIdx(nextFrames.length - 1);
            return nextFrames;
        });
    };
    
    const deleteFrame = (index: number) => {
        if(frames.length <= 1){
            return;
        }
        // _ -> 실제 객체 데이터는 조건 검사 쓰지 않기 때문에 관습적으로 사용하지 않음을 뜻하는 _로 표기
        const newFrame = frames.filter((_, i) => i !== index);
        setFrames(newFrame);
        setCurrentFrameIdx(Math.max(0, index - 1));
    };

    return {frames, currentFrameIdx, setFrames, setCurrentFrameIdx, addFrame, deleteFrame};
}