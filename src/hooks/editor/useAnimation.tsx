import { useEffect, useState } from "react";
import type { FrameData } from "../../type/editor";
import { MIN_DURATION_30FPS } from "../../constants/editor/editor";

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

    // 기본 지속시간(새 프레임 생성 등에 사용)
    const defaultDuration = draftFps === null ? getDuration(frames[0]) : 1000 / draftFps;
    
    // Fps 지정
    const setFps = (nextFps: number) => {
        if (Number.isFinite(nextFps) && nextFps > 0) {
            setDraft({ frames, fps: nextFps });
        }
    };

    // frames 변경시 setDraft 초기화
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

        // 재생 안전가드 적용
        const safePlayDuration = (Number.isFinite(duration) && duration > 0)
        ? Math.max(MIN_DURATION_30FPS, duration) 
        : 1000; // 계산 실패 시 안전하게 1초(1000ms) 대기
        
        // 각 프레임에 저장된 표시 시간만큼 기다린 뒤 다음 프레임으로 이동한다.
        const timeout = setTimeout(() => {
            setPreviewFrameIdx((safePreviewFrameIdx + 1) % frames.length);
        }, safePlayDuration);
        return () => clearTimeout(timeout);
    }, [isPlaying, frames.length, safePreviewFrameIdx, duration]);

    return { isPlaying, previewFrameIdx: safePreviewFrameIdx, fps, defaultDuration, setIsPlaying, setPreviewFrameIdx, setFps };
}
