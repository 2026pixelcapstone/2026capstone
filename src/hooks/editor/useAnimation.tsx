import { useEffect, useState } from "react";

interface UseAnimation{
    frameLength: number,
}
export function useAnimation({
    frameLength,
}: UseAnimation){
    const [isPlaying, setIsPlaying] = useState(false);
    const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
    
    // 재생 로직
    useEffect(() => {
        if(!isPlaying){
          setPreviewFrameIdx(0); // 재생 중이 아니면 항상 첫 프레임으로 초기화
          return;
        }
        const totalFrames = frameLength;
        if(totalFrames <= 1) return;
    
        const interval = setInterval(() => {
          setPreviewFrameIdx((prevIdx) => (prevIdx + 1) % totalFrames);
        }, 100);
        
        return () => clearInterval(interval);
    }, [isPlaying, frameLength, setPreviewFrameIdx]);
    
      // 프레임 수가 바뀌면 미리보기 인덱스를 0으로 초기화
      useEffect(() => {
        setPreviewFrameIdx(0);
      }, [frameLength]);
    return{ isPlaying, previewFrameIdx, setIsPlaying, setPreviewFrameIdx }
}