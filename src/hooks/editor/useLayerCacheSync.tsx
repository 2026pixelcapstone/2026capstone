import { useEffect, useRef } from "react";
import { FrameData } from "../../type/editor";
import { getCacheKey } from "../../utils/editorUtils";

interface UseLayerCacheSync {
    frames: FrameData[];
    activeFrameId: string | null;
    clearLayerCanvas: (cacheKey: string) => void;
}

/**
 * 화면에 안 보이는 프레임의 레이어 캐시가 옛 그림으로 남지 않게(PR-B).
 * 캐시는 화면에 그리는 프레임만 LayerImageRender가 다시 채움 → 반전·회전처럼 모든 프레임을 바꾸거나, 다른 프레임을 보는 중에
 * 되돌리기를 하면 안 보이는 프레임 캐시는 옛 그림 그대로라 GIF 내보내기·미리보기가 옛 그림을 씀.
 * pixelData가 바뀐 레이어 중 지금 프레임이 아닌 것의 캐시를 지움 → 다음에 쓸 때 pixelData에서 다시 만듦.
 * (지금 프레임은 건드리지 않음 — 그리는 중인 캐시를 지우면 그린 것이 사라질 수 있음)
 */
export function useLayerCacheSync({ frames, activeFrameId, clearLayerCanvas }: UseLayerCacheSync) {
    const prev = useRef<Map<string, string>>(new Map());
    useEffect(() => {
        const next = new Map<string, string>();
        for (const f of frames) {
            for (const l of f.layers) {
                const key = getCacheKey(f.id, l.id);
                next.set(key, l.pixelData);
                const before = prev.current.get(key);
                if (before !== undefined && before !== l.pixelData && f.id !== activeFrameId) clearLayerCanvas(key);
            }
        }
        prev.current = next;
    }, [frames, activeFrameId, clearLayerCanvas]);
}
