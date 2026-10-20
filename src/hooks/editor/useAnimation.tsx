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

export function useAnimation({ frames }: UseAnimation) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
    // 드래그 중에만 임시 속도를 사용하고, 저장·Undo·불러오기 후에는 저장된 값을 사용한다.
    const [draft, setDraft] = useState<{ frames: FrameData[]; fps: number } | null>(null);
    const draftFps = draft?.frames === frames ? draft.fps : null;
    const safePreviewFrameIdx = Math.max(0, Math.min(previewFrameIdx, frames.length - 1));
    const duration = draftFps === null
        ? getDuration(frames[safePreviewFrameIdx])
        : 1000 / draftFps;
    const fps = draftFps ?? Number((1000 / getDuration(frames[0])).toFixed(2));

    const setFps = (nextFps: number) => {
        if (Number.isFinite(nextFps) && nextFps > 0) {
            setDraft({ frames, fps: nextFps });
        }
    };

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
    }, [isPlaying, frames, safePreviewFrameIdx, duration]);

    useEffect(() => {
        setPreviewFrameIdx(0);
    }, [frames.length]);

    return { isPlaying, previewFrameIdx: safePreviewFrameIdx, setIsPlaying, setPreviewFrameIdx, fps, setFps };
}
