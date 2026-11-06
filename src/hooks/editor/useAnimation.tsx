import { useCallback, useState } from "react";
import type { AnimationTag, CanvasState, FrameData } from "../../type/editor";

interface UseAnimation {
    frames: FrameData[];
    setWithHistory: React.Dispatch<React.SetStateAction<CanvasState>>;
}

function getDuration(frame: FrameData | undefined) {
    const duration = frame?.duration;
    return duration !== undefined && Number.isFinite(duration) && duration > 0
        ? duration
        : 100;
}

export function useAnimation({ 
    frames,
    setWithHistory,
}: UseAnimation) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeAnimId, setActiveAnimId] = useState<string | null>(null);

    // FPS는 프레임별 duration과 독립적으로 유지하고, 슬라이더로만 변경합니다.
    const [fps, setFpsState] = useState(() => Math.round(1000 / getDuration(frames[0])));

    // 기본 지속시간(새 프레임 생성 등에 사용)
    const defaultDuration = Math.round(1000 / Math.max(1, fps));
    
    // Fps 지정
    const setFps = (nextFps: number) => {
        if (Number.isFinite(nextFps) && nextFps > 0) {
            setFpsState(nextFps);
        }
    };


    // 애니메이션 태그 생성
    const createAnimationTag = useCallback((name: string, color: string) => {
        const newAnimationTag: AnimationTag = {
            id: `anim-${crypto.randomUUID()}`,
            name: name,
            color: color,
            fromIndex: 0,
            toIndex: 0,
        };

        setWithHistory((prev: CanvasState) => ({
            ...prev, 
            animationTags: [...(prev.animationTags || []), newAnimationTag]
        }));

    }, [setWithHistory])

    // 애니메이션 태그 삭제
    const deleteAnimationTag = useCallback((tagIdToDelete: string | null) => {
        if(!tagIdToDelete) return;
        if (!window.confirm('선택한 애니메이션 태그를 삭제하시겠습니까?')) return;

        // 1. 캔버스 상태에서 해당 태그 제거
        setWithHistory((prev: CanvasState) => ({
            ...prev,
            animationTags: (prev.animationTags || []).filter(tag => tag.id !== tagIdToDelete), // 태그 리스트에서 삭제
            // 데이터 무결성 보장: 이 태그를 사용 중이던 프레임들의 태그 속성도 함께 지워줍니다.
            frames: prev.frames.map(frame => 
                frame.tagId === tagIdToDelete 
                    ? { ...frame, tagId: null } 
                    : frame
            )
        }));

        // 2. 만약 현재 드롭다운에서 선택해서 보고 있던 태그라면 '전체 재생'으로 초기화
        if (activeAnimId === tagIdToDelete) {
            setActiveAnimId(null);
        }
}, [setWithHistory, activeAnimId, setActiveAnimId]);
    
    return { activeAnimId, isPlaying, fps, defaultDuration, setActiveAnimId, setIsPlaying, setFps, createAnimationTag, deleteAnimationTag };
}
