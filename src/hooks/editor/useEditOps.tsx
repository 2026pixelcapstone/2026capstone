/**
 * 편집 메뉴 보강(PR-F) — 선택 영역으로 자르기·빈 여백 자르기·레이어 내용 지우기.
 * 자르기는 캔버스 크기 바꾸기(useCanvasSize.applyCanvasSize)에 '옮길 위치'를 넘겨 모든 프레임·레이어를 한 번에(되돌리기 한 번).
 */
import { useCallback } from 'react';
import type { CanvasState } from '../../type/editor';
import type { Selection } from '../../utils/selection';
import { getCacheKey } from '../../utils/editorUtils';
import { toast } from '../../store/toastStore';

interface Props {
    state: CanvasState;
    activeFrameId: string | null;
    activeLayerId: string | null;
    selectionRef: React.RefObject<Selection | null>;
    deselect: () => void;
    applyCanvasSize: (w: number, h: number, offset?: { x: number; y: number }) => Promise<void> | void;
    peekLayerCanvas: (cacheKey: string) => HTMLCanvasElement | null;
    ensureLayerCanvas: (cacheKey: string) => HTMLCanvasElement | null;
    redrawLayer: (layerId: string) => void;
    commitLayerChanges: (frameId: string | null, layerId: string | null) => void;
}

async function readBounds(src: HTMLCanvasElement | string, w: number, h: number) {
    let c: HTMLCanvasElement;
    if (typeof src === 'string') {
        const img = new Image();
        img.src = src;
        await img.decode();
        c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(img, 0, 0);
    } else c = src;
    const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] === 0) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function useEditOps(p: Props) {
    const { state, activeFrameId, activeLayerId, selectionRef, deselect, applyCanvasSize, peekLayerCanvas, ensureLayerCanvas, redrawLayer, commitLayerChanges } = p;

    const cropToSelection = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) { toast.info('먼저 자를 영역을 선택해 주세요.'); return; }
        const { x0, y0, x1, y1 } = sel.bounds;
        deselect();
        void applyCanvasSize(x1 - x0 + 1, y1 - y0 + 1, { x: -x0, y: -y0 });
    }, [selectionRef, deselect, applyCanvasSize]);

    /** 모든 프레임·레이어에서 그림이 있는 범위만 남김 */
    const trimCanvas = useCallback(async () => {
        const { width: w, height: h } = state;
        let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
        try {
            for (const f of state.frames) for (const l of f.layers) {
                const src = peekLayerCanvas(getCacheKey(f.id, l.id)) ?? (l.pixelData || null);
                if (!src) continue;
                const b = await readBounds(src, w, h);
                if (!b) continue;
                box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) } : b;
            }
        } catch {
            toast.error('그림을 읽지 못했어요.');
            return;
        }
        if (!box) { toast.info('그림이 없어서 자를 수 없어요.'); return; }
        if (box.x0 === 0 && box.y0 === 0 && box.x1 === w - 1 && box.y1 === h - 1) { toast.info('잘라낼 빈 여백이 없어요.'); return; }
        deselect();
        await applyCanvasSize(box.x1 - box.x0 + 1, box.y1 - box.y0 + 1, { x: -box.x0, y: -box.y0 });
    }, [state, peekLayerCanvas, deselect, applyCanvasSize]);

    /** 지금 레이어 내용 전부 지우기(잠긴 레이어는 막음) */
    const clearLayer = useCallback(() => {
        if (!activeFrameId || !activeLayerId) return;
        const layer = state.frames.find(f => f.id === activeFrameId)?.layers.find(l => l.id === activeLayerId);
        if (!layer) return;
        if (layer.isLocked) { toast.info('잠긴 레이어예요. 자물쇠를 풀고 다시 해 주세요.'); return; }
        if (!layer.pixelData) { toast.info('이미 빈 레이어예요.'); return; }
        const c = ensureLayerCanvas(getCacheKey(activeFrameId, activeLayerId));
        if (!c) return;
        c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
        redrawLayer(activeLayerId);
        commitLayerChanges(activeFrameId, activeLayerId);
    }, [state.frames, activeFrameId, activeLayerId, ensureLayerCanvas, redrawLayer, commitLayerChanges]);

    return { cropToSelection, trimCanvas, clearLayer };
}
