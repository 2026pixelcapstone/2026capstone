import { useEffect, useState } from "react";
import type { FrameData } from "../../type/editor";

interface UseAnimation {
    frames: FrameData[];
}

function getDuration(frame: FrameData | undefined) {
    const duration = frame?.duration;
    return duration !== undefined && Number.isFinite(duration) && duration > 0
        ? duration
        : 100;
}

export function useAnimation({ 
    frames,
}: UseAnimation) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [previewFrameIdx, setPreviewFrameIdx] = useState(0);

    // 임시 속도
    const [draft, setDraft] = useState<{ frames: FrameData[]; fps: number } | null>(null);
    const draftFps = draft?.frames === frames ? draft.fps : null; 
    
    const safePreviewFrameIdx = Math.max(0, Math.min(previewFrameIdx, frames.length - 1));

    // previewFrameIdx번 프레임의 duration 추출
    const duration = draftFps === null
        ? getDuration(frames[safePreviewFrameIdx])
        : 1000 / draftFps;
    const fps = draftFps ?? Number((1000 / getDuration(frames[0])).toFixed(2));
    const defaultDuration = Math.round(1000 / Math.max(1, fps));

    // Fps 지정
    const setFps = (nextFps: number) => {
        if (Number.isFinite(nextFps) && nextFps > 0) {
            setDraft({ frames, fps: nextFps });
        }
    };

    // setWithHistory 변경시 setDraft 초기화
    useEffect(()=> {
        setDraft(null);
    }, [frames])

    // 애니메이션 실행 effect
    useEffect(() => {
        if (!isPlaying) {
            setPreviewFrameIdx(0);
            return;
        }
        if (frames.length <= 1) return;

        // 각 프레임에 저장된 표시 시간만큼 기다린 뒤 다음 프레임으로 이동한다.
        const timeout = setTimeout(() => {
            setPreviewFrameIdx((safePreviewFrameIdx + 1) % frames.length);
        }, duration);
        return () => clearTimeout(timeout);
    }, [isPlaying, frames.length, safePreviewFrameIdx, duration]);

    return { isPlaying, previewFrameIdx: safePreviewFrameIdx, fps, defaultDuration, setIsPlaying, setPreviewFrameIdx, setFps };
}
