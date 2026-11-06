import React, { useCallback, useEffect, useRef, useState } from "react";
import { CanvasState, FrameData, LayerData } from "../../type/editor";
import { toast } from "../../store/toastStore";
import { applyGeo, canvasToPixelData, composite, GeoOp, geoSize, loadPixelData } from "../../utils/pixelOps";

/** 색 조정 등을 어디까지 적용할지 */
export type OpScope = 'layer' | 'frame' | 'all';

interface UseImageOps {
    state: CanvasState;
    activeFrameId: string | null;
    activeLayerId: string | null;
    setActiveLayerId: React.Dispatch<React.SetStateAction<string | null>>;
    setWithHistory: React.Dispatch<React.SetStateAction<CanvasState>>;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
}

const GEO_LABEL: Record<GeoOp, string> = {
    flipH: '좌우 반전', flipV: '상하 반전', rot90cw: '시계 방향 90° 회전', rot90ccw: '반시계 방향 90° 회전', rot180: '180° 회전',
};

/**
 * 이미지·레이어 메뉴 동작(PR-B).
 * - 그림 원본은 항상 상태의 pixelData(캐시가 아님) → 화면에 안 보이는 프레임도 정확.
 * - 계산은 비동기라, 시작할 때의 frames를 기억했다가 그대로일 때만 반영(그 사이 그린 것을 덮지 않게).
 * - 반영은 setWithHistory 한 번 → 되돌리기 한 번에 통째로 돌아감.
 * - 잠긴 레이어: 반전·회전은 캔버스 전체 변환이라 함께 바뀜(안 그러면 레이어끼리 어긋남), 색 조정·외곽선은 건너뜀.
 */
export function useImageOps({ state, activeFrameId, activeLayerId, setActiveLayerId, setWithHistory, setUnsaved }: UseImageOps) {
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);

    /** 비동기 계산 → 그 사이 그림이 안 바뀌었으면 한 번에 반영 */
    const runAsync = useCallback(async (label: string, compute: (snap: CanvasState) => Promise<CanvasState | null>) => {
        if (busyRef.current) return false;
        busyRef.current = true;
        setBusy(true);
        const snap = stateRef.current;
        try {
            const next = await compute(snap);
            if (!next) return false;
            if (stateRef.current.frames !== snap.frames) {
                toast.error(`${label} 중에 그림이 바뀌어 적용하지 않았어요. 다시 시도해 주세요.`);
                return false;
            }
            setWithHistory(prev => (prev.frames === snap.frames ? next : prev));
            setUnsaved(true);
            return true;
        } catch (e) {
            console.error(e);
            toast.error(`${label}에 실패했어요.`);
            return false;
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }, [setWithHistory, setUnsaved]);

    // ── 이미지 전체 반전·회전(모든 프레임·레이어) ──
    const transformImage = useCallback((op: GeoOp) => runAsync(GEO_LABEL[op], async (snap) => {
        const { w, h } = geoSize(op, snap.width, snap.height);
        const frames: FrameData[] = await Promise.all(snap.frames.map(async f => ({
            ...f,
            layers: await Promise.all(f.layers.map(async l => {
                const src = await loadPixelData(l.pixelData, snap.width, snap.height);
                return src ? { ...l, pixelData: canvasToPixelData(applyGeo(src, op)) } : l;
            })),
        })));
        return { ...snap, frames, width: w, height: h };
    }), [runAsync]);

    /** 대상 레이어 고르기(잠긴 레이어 제외) */
    const targets = (scope: OpScope) => (f: FrameData, l: LayerData) => {
        if (l.isLocked) return false;
        if (scope === 'all') return true;
        if (f.id !== activeFrameId) return false;
        return scope === 'frame' || l.id === activeLayerId;
    };

    // ── 칸별 색 변환(색 조정·외곽선·색 바꾸기 등) ──
    const applyLayerFilter = useCallback((label: string, scope: OpScope, fn: (c: HTMLCanvasElement) => HTMLCanvasElement) => {
        const snap0 = stateRef.current;
        const pick = targets(scope);
        if (!snap0.frames.some(f => f.layers.some(l => pick(f, l)))) {
            toast.error(scope === 'layer' ? '선택한 레이어가 잠겨 있어요.' : '바꿀 수 있는 레이어가 없어요(모두 잠김).');
            return Promise.resolve(false);
        }
        return runAsync(label, async (snap) => {
            const ok = targets(scope);
            let changed = false;
            const frames = await Promise.all(snap.frames.map(async f => ({
                ...f,
                layers: await Promise.all(f.layers.map(async l => {
                    if (!ok(f, l)) return l;
                    const src = await loadPixelData(l.pixelData, snap.width, snap.height);
                    if (!src) return l;
                    const pixelData = canvasToPixelData(fn(src));
                    if (pixelData === l.pixelData) return l;
                    changed = true;
                    return { ...l, pixelData };
                })),
            })));
            if (!changed) { toast.info('바뀐 칸이 없어요.'); return null; }
            return { ...snap, frames };
        });
    }, [runAsync, activeFrameId, activeLayerId]);

    /** 미리보기용: 지금 레이어(또는 프레임 합성) 그림 */
    const loadActiveLayerCanvas = useCallback(async () => {
        const snap = stateRef.current;
        const f = snap.frames.find(x => x.id === activeFrameId);
        const l = f?.layers.find(x => x.id === activeLayerId);
        return l ? loadPixelData(l.pixelData, snap.width, snap.height) : null;
    }, [activeFrameId, activeLayerId]);

    // ── 레이어(지금 프레임) ──
    const currentFrame = () => stateRef.current.frames.find(f => f.id === activeFrameId) ?? null;

    const duplicateLayer = useCallback(() => {
        const f = currentFrame();
        const idx = f?.layers.findIndex(l => l.id === activeLayerId) ?? -1;
        if (!f || idx < 0) return;
        const src = f.layers[idx];
        const copy: LayerData = { ...src, id: `layer-${crypto.randomUUID().slice(0, 8)}`, name: `${src.name} 복사`, isLocked: false };
        setWithHistory(prev => ({
            ...prev,
            frames: prev.frames.map(fr => {
                if (fr.id !== f.id) return fr;
                const layers = [...fr.layers];
                const at = layers.findIndex(l => l.id === src.id);
                if (at < 0) return fr;
                layers.splice(at + 1, 0, copy);   // 바로 위에
                return { ...fr, layers: layers.map((l, i) => ({ ...l, layerOrder: i })) };
            }),
        }));
        setActiveLayerId(copy.id);
        setUnsaved(true);
    }, [activeFrameId, activeLayerId, setWithHistory, setActiveLayerId, setUnsaved]);

    /** dir = +1 위로(앞에 그려짐) / −1 아래로 */
    const moveLayer = useCallback((dir: 1 | -1) => {
        const f = currentFrame();
        if (!f) return;
        const sorted = [...f.layers].sort((a, b) => a.layerOrder - b.layerOrder);
        const idx = sorted.findIndex(l => l.id === activeLayerId);
        const to = idx + dir;
        if (idx < 0 || to < 0 || to >= sorted.length) {
            toast.info(dir > 0 ? '이미 맨 위 레이어예요.' : '이미 맨 아래 레이어예요.');
            return;
        }
        [sorted[idx], sorted[to]] = [sorted[to], sorted[idx]];
        const layers = sorted.map((l, i) => ({ ...l, layerOrder: i }));
        setWithHistory(prev => ({ ...prev, frames: prev.frames.map(fr => (fr.id === f.id ? { ...fr, layers } : fr)) }));
        setUnsaved(true);
    }, [activeFrameId, activeLayerId, setWithHistory, setUnsaved]);

    /**
     * 보이는 레이어 병합: 보이는 레이어를 화면과 같은 순서·투명도로 합쳐, 가장 아래 보이는 레이어 자리에 하나로. 숨긴 레이어는 그대로.
     * 이미지 병합: 보이는 것만 합친 레이어 하나만 남김(숨긴 레이어는 버림 — 포토샵·Aseprite와 같음).
     */
    const mergeLayers = useCallback((mode: 'visible' | 'flatten' | 'down') => {
        const label = mode === 'visible' ? '보이는 레이어 병합' : mode === 'down' ? '아래 레이어와 병합' : '이미지 병합';
        const f0 = currentFrame();
        if (!f0) return Promise.resolve(false);
        // 아래 레이어와 병합(PR-F): 지금 레이어 + 바로 아래 레이어 → 아래 레이어 자리에 하나로(보이기 여부와 상관없이 둘만)
        if (mode === 'down') {
            const sorted0 = [...f0.layers].sort((a, b) => a.layerOrder - b.layerOrder);
            const idx0 = sorted0.findIndex(l => l.id === activeLayerId);
            if (idx0 <= 0) { toast.info('아래에 합칠 레이어가 없어요.'); return Promise.resolve(false); }
            const topId = sorted0[idx0].id, belowId = sorted0[idx0 - 1].id;
            const newIdDown = `layer-${crypto.randomUUID().slice(0, 8)}`;
            return runAsync(label, async (snap) => {
                const f = snap.frames.find(x => x.id === f0.id);
                if (!f) return null;
                const sorted = [...f.layers].sort((a, b) => a.layerOrder - b.layerOrder);
                const below = sorted.find(l => l.id === belowId), top = sorted.find(l => l.id === topId);
                if (!below || !top) return null;
                const [cb, ct] = await Promise.all([loadPixelData(below.pixelData, snap.width, snap.height), loadPixelData(top.pixelData, snap.width, snap.height)]);
                const merged = composite([
                    { canvas: cb, opacity: below.opacity, blendMode: 'NORMAL' },
                    { canvas: ct, opacity: top.opacity, blendMode: top.blendMode },
                ], snap.width, snap.height);
                const mergedLayer: LayerData = { ...below, id: newIdDown, isVisible: true, isLocked: false, opacity: 100, blendMode: below.blendMode, pixelData: canvasToPixelData(merged) };
                const layers = sorted.filter(l => l.id !== topId).map(l => (l.id === belowId ? mergedLayer : l)).map((l, i) => ({ ...l, layerOrder: i }));
                return { ...snap, frames: snap.frames.map(fr => (fr.id === f.id ? { ...fr, layers } : fr)) };
            }).then(ok => { if (ok) setActiveLayerId(newIdDown); return ok; });
        }
        const visible0 = f0.layers.filter(l => l.isVisible);
        if (mode === 'visible' && visible0.length < 2) {
            toast.info('보이는 레이어가 2개 이상일 때 합칠 수 있어요.');
            return Promise.resolve(false);
        }
        if (mode === 'flatten' && f0.layers.length < 2) {
            toast.info('레이어가 하나뿐이에요.');
            return Promise.resolve(false);
        }
        const newId = `layer-${crypto.randomUUID().slice(0, 8)}`;
        return runAsync(label, async (snap) => {
            const f = snap.frames.find(x => x.id === f0.id);
            if (!f) return null;
            const sorted = [...f.layers].sort((a, b) => a.layerOrder - b.layerOrder);
            const vis = sorted.filter(l => l.isVisible);
            const canvases = await Promise.all(vis.map(l => loadPixelData(l.pixelData, snap.width, snap.height)));
            const merged = composite(vis.map((l, i) => ({ canvas: canvases[i], opacity: l.opacity, blendMode: i === 0 ? 'NORMAL' : l.blendMode })), snap.width, snap.height);
            const base = vis[0] ?? sorted[0];
            const mergedLayer: LayerData = {
                ...base, id: newId, name: mode === 'flatten' ? '배경' : '병합됨',
                isVisible: true, isLocked: false, opacity: 100, blendMode: 'NORMAL', pixelData: canvasToPixelData(merged),
            };
            let layers: LayerData[];
            if (mode === 'flatten') layers = [mergedLayer];
            else {
                const visIds = new Set(vis.map(l => l.id));
                layers = [];
                for (const l of sorted) {
                    if (l.id === base.id) layers.push(mergedLayer);
                    else if (!visIds.has(l.id)) layers.push(l);
                }
            }
            layers = layers.map((l, i) => ({ ...l, layerOrder: i }));
            return { ...snap, frames: snap.frames.map(fr => (fr.id === f.id ? { ...fr, layers } : fr)) };
        }).then(ok => { if (ok) setActiveLayerId(newId); return ok; });
    }, [runAsync, activeFrameId, activeLayerId, setActiveLayerId]);

    return { busy, runEdit: runAsync, transformImage, applyLayerFilter, loadActiveLayerCanvas, duplicateLayer, moveLayer, mergeLayers };
}
