import React, { useCallback } from "react";
import { CanvasState } from "../../type/editor";

interface UseFrameOps {
    state: CanvasState;
    activeFrameId: string | null;
    activeLayerId: string | null;
    setActiveFrameId: React.Dispatch<React.SetStateAction<string | null>>;
    setActiveLayerId: React.Dispatch<React.SetStateAction<string | null>>;
    setWithHistory: React.Dispatch<React.SetStateAction<CanvasState>>;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * 프레임 복제(PR-D) — 팀원 영역인 useFrame은 건드리지 않고 같은 상태(setWithHistory)로 처리.
 * 지금 프레임 바로 뒤에 복사본(프레임·레이어 id 새로) → 애니메이션 태그 범위도 같이 밀어 줌
 * (복제한 프레임이 태그 안이면 그 태그 끝 +1, 뒤에 있는 태그는 시작·끝 +1). 되돌리기 한 번에 돌아감.
 */
export function useFrameOps({ state, activeFrameId, activeLayerId, setActiveFrameId, setActiveLayerId, setWithHistory, setUnsaved }: UseFrameOps) {
    const duplicateFrame = useCallback(() => {
        const idx = state.frames.findIndex(f => f.id === activeFrameId);
        if (idx < 0) return;
        const src = state.frames[idx];
        const layerIdx = Math.max(0, src.layers.findIndex(l => l.id === activeLayerId));
        const copy = {
            ...src,
            id: `frame-${crypto.randomUUID()}`,
            layers: src.layers.map(l => ({ ...l, id: `layer-${crypto.randomUUID().slice(0, 8)}` })),
        };
        setWithHistory(prev => {
            const at = prev.frames.findIndex(f => f.id === src.id);
            if (at < 0) return prev;
            const frames = [...prev.frames];
            frames.splice(at + 1, 0, copy);
            return {
                ...prev,
                frames: frames.map((f, i) => ({ ...f, frameOrder: i })),
                animationTags: (prev.animationTags ?? []).map(t =>
                    t.fromIndex > at ? { ...t, fromIndex: t.fromIndex + 1, toIndex: t.toIndex + 1 }
                        : t.toIndex >= at ? { ...t, toIndex: t.toIndex + 1 }
                            : t),
            };
        });
        setActiveFrameId(copy.id);
        setActiveLayerId(copy.layers[layerIdx]?.id ?? copy.layers[0]?.id ?? null);
        setUnsaved(true);
    }, [state.frames, activeFrameId, activeLayerId, setWithHistory, setActiveFrameId, setActiveLayerId, setUnsaved]);

    /** 프레임 순서 뒤집기(PR-F) — 애니메이션 태그 범위도 거울처럼 뒤집음(0..n-1 → n-1..0). 되돌리기 한 번 */
    const reverseFrames = useCallback(() => {
        if (state.frames.length < 2) return false;
        setWithHistory(prev => {
            const n = prev.frames.length;
            if (n < 2) return prev;
            return {
                ...prev,
                frames: [...prev.frames].reverse().map((f, i) => ({ ...f, frameOrder: i })),
                animationTags: (prev.animationTags ?? []).map(t => ({ ...t, fromIndex: n - 1 - t.toIndex, toIndex: n - 1 - t.fromIndex })),
            };
        });
        setUnsaved(true);
        return true;
    }, [state.frames.length, setWithHistory, setUnsaved]);

    /**
     * 프레임 사이에 새 프레임 넣기(AI 중간 동작 제안) — afterId 바로 뒤에 레이어 하나짜리 프레임들을 순서대로.
     * 여러 장도 한 번의 상태 변경으로(되돌리기 한 번), 길이는 앞 프레임과 같게, 애니메이션 태그 범위는 복제와 같은 규칙으로 밈.
     */
    const insertFramesAfter = useCallback((afterId: string, items: { pixelData: string; name: string }[]) => {
        const src = state.frames.find(f => f.id === afterId);
        if (!src || items.length === 0) return 0;
        const made = items.map(it => {
            const layerId = `layer-${crypto.randomUUID().slice(0, 8)}`;
            return {
                id: `frame-${crypto.randomUUID()}`,
                tagId: src.tagId ?? null,
                duration: src.duration,
                layers: [{
                    id: layerId, name: it.name, layerOrder: 0, blendMode: 'NORMAL' as const, isLocked: false,
                    isVisible: true, opacity: 100, color: '#818cf8', pixelData: it.pixelData,
                }],
            };
        });
        const k = made.length;
        setWithHistory(prev => {
            const at = prev.frames.findIndex(f => f.id === afterId);
            if (at < 0) return prev;
            const frames = [...prev.frames];
            frames.splice(at + 1, 0, ...made);
            return {
                ...prev,
                frames: frames.map((f, i) => ({ ...f, frameOrder: i })),
                animationTags: (prev.animationTags ?? []).map(t =>
                    t.fromIndex > at ? { ...t, fromIndex: t.fromIndex + k, toIndex: t.toIndex + k }
                        : t.toIndex >= at ? { ...t, toIndex: t.toIndex + k }
                            : t),
            };
        });
        setActiveFrameId(made[0].id);
        setActiveLayerId(made[0].layers[0].id);
        setUnsaved(true);
        return k;
    }, [state.frames, setWithHistory, setActiveFrameId, setActiveLayerId, setUnsaved]);

    /**
     * 거의 같은 두 프레임 합치기(AI 타이밍 점검) — keep 길이 += drop 길이, drop 삭제. 되돌리기 한 번.
     * drop 뒤의 애니메이션 태그는 한 칸씩 당기고, drop을 포함한 태그는 끝만 당김(패널이 두 프레임의 태그 소속이 같을 때만 부름).
     */
    const mergeFrames = useCallback((keepId: string, dropId: string) => {
        if (keepId === dropId || state.frames.length < 2) return false;
        if (!state.frames.some(f => f.id === keepId) || !state.frames.some(f => f.id === dropId)) return false;
        setWithHistory(prev => {
            const keep = prev.frames.find(f => f.id === keepId);
            const at = prev.frames.findIndex(f => f.id === dropId);
            if (!keep || at < 0) return prev;
            const drop = prev.frames[at];
            const add = (d?: number) => (d && d > 0 ? d : 100);
            const frames = prev.frames
                .filter(f => f.id !== dropId)
                .map(f => (f.id === keepId ? { ...f, duration: add(keep.duration) + add(drop.duration) } : f))
                .map((f, i) => ({ ...f, frameOrder: i }));
            return {
                ...prev,
                frames,
                animationTags: (prev.animationTags ?? []).map(t =>
                    t.fromIndex > at ? { ...t, fromIndex: t.fromIndex - 1, toIndex: t.toIndex - 1 }
                        : t.toIndex >= at ? { ...t, toIndex: Math.max(t.fromIndex, t.toIndex - 1) }
                            : t),
            };
        });
        if (activeFrameId === dropId) {
            const keep = state.frames.find(f => f.id === keepId);
            setActiveFrameId(keepId);
            setActiveLayerId(keep?.layers[0]?.id ?? null);
        }
        setUnsaved(true);
        return true;
    }, [state.frames, activeFrameId, setWithHistory, setActiveFrameId, setActiveLayerId, setUnsaved]);

    /** 이전·다음 프레임 id(끝에서는 반대쪽으로 돌아감) */
    const neighborFrameId = useCallback((dir: 1 | -1) => {
        const n = state.frames.length;
        if (n < 2) return null;
        const idx = Math.max(0, state.frames.findIndex(f => f.id === activeFrameId));
        return state.frames[(idx + dir + n) % n].id;
    }, [state.frames, activeFrameId]);

    return { duplicateFrame, reverseFrames, neighborFrameId, insertFramesAfter, mergeFrames };
}
