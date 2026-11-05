import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasState, EditorToolId, Point } from "../../type/editor";
import { getCacheKey } from "../../utils/editorUtils";
import { canvasToPixelData, makeCanvas } from "../../utils/pixelOps";
import { toast } from "../../store/toastStore";
import {
    clearSelection, extractSelection, fullSelection, polygonSelection, rectSelection, Selection, selectionOutline,
    shiftSelection, snapEnd, snapStart,
} from "../../utils/selection";

interface UseSelection {
    state: CanvasState;
    activeFrameId: string | null;
    activeLayerId: string | null;
    activeTool: EditorToolId;
    setActiveTool: React.Dispatch<React.SetStateAction<EditorToolId>>;
    selectionRef: React.RefObject<Selection | null>;
    ensureLayerCanvas: (cacheKey: string) => HTMLCanvasElement | null;
    commitLayerChanges: (frameId: string | null, layerId: string | null) => void;
    addLayer: (frameId: string | null, init?: { name: string; pixelData: string }) => void;
    redrawLayer: (layerId: string) => void;
    importImageFile: (file: File) => void;
    gridSnap: boolean;
    gridSize: number;
}

/** 붙여넣기용 보관(에디터 안 복사) */
interface Clip { canvas: HTMLCanvasElement; x: number; y: number }

/** 끌어서 범위를 정할 때 격자에 맞춤(시작은 격자선, 끝은 다음 격자선 앞 칸) */
function snapRange(a: Point, b: Point, g: number): [Point, Point] {
    const lo = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) };
    const hi = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
    return [{ x: snapStart(lo.x, g), y: snapStart(lo.y, g) }, { x: snapEnd(hi.x, g), y: snapEnd(hi.y, g) }];
}

function isTyping(t: EventTarget | null) {
    const el = t as HTMLElement | null;
    if (!el) return false;
    if (el.tagName === 'INPUT') return !['checkbox', 'radio', 'range', 'button', 'color'].includes((el as HTMLInputElement).type);
    return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * 선택·이동·복사·붙여넣기(PR-D).
 * - 사각 선택·올가미: 끄는 동안 미리보기 → 놓으면 선택(그냥 클릭 = 선택 해제).
 * - 이동: 선택 안 칸(선택 없으면 레이어 전체)을 들어 옮김 — 직선 도구처럼 레이어 캐시에 바로 미리 그리고, 놓을 때 commitLayerChanges로 기록 한 번.
 * - 복사·잘라내기·삭제는 지금 레이어, 붙여넣기는 새 레이어(포토샵 방식) + 그 영역 선택 + 이동 도구.
 * - 다른 프로그램에서 복사한 이미지는 paste 이벤트로 받아 '이미지 불러오기'와 같은 규칙으로 새 레이어.
 */
export function useSelection(p: UseSelection) {
    const { state, activeFrameId, activeLayerId, activeTool, setActiveTool, selectionRef, gridSnap, gridSize } = p;
    const [selection, setSelectionState] = useState<Selection | null>(null);
    const [draft, setDraft] = useState<{ kind: 'rect'; a: Point; b: Point } | { kind: 'lasso'; pts: Point[] } | null>(null);
    const clip = useRef<Clip | null>(null);
    const moving = useRef<{ ctx: CanvasRenderingContext2D; base: ImageData; float: HTMLCanvasElement; fx: number; fy: number; start: Point; sel: Selection; layerId: string; frameId: string; dx: number; dy: number } | null>(null);
    const [moveOffset, setMoveOffset] = useState<{ dx: number; dy: number } | null>(null);

    const setSelection = useCallback((s: Selection | null) => {
        selectionRef.current = s;
        setSelectionState(s);
    }, [selectionRef]);

    // 캔버스 크기가 바뀌면(회전·크기 조절·불러오기) 선택은 맞지 않으므로 해제
    useEffect(() => { setSelection(null); }, [state.width, state.height, setSelection]);
    // 다른 프레임으로 가면 이동 중이던 것은 없음(선택 영역은 유지 — 같은 자리 작업이 흔함)

    const layerCtx = useCallback(() => {
        if (!activeFrameId || !activeLayerId) return null;
        return ensureCtx(p.ensureLayerCanvas(getCacheKey(activeFrameId, activeLayerId)));
    }, [activeFrameId, activeLayerId, p]);

    // ── 마우스(useCanvasDrawing이 선택 도구일 때 넘겨줌) ──
    const down = useCallback((pos: Point) => {
        if (activeTool === 'marquee') { setDraft({ kind: 'rect', a: pos, b: pos }); return; }
        if (activeTool === 'lasso') { setDraft({ kind: 'lasso', pts: [pos] }); return; }
        if (activeTool === 'move') {
            const ctx = layerCtx();
            if (!ctx || !activeFrameId || !activeLayerId) return;
            const sel = selectionRef.current ?? fullSelection(state.width, state.height);
            if (!sel) return;
            const { canvas, x, y } = extractSelection(ctx, sel);
            clearSelection(ctx, sel);
            const base = ctx.getImageData(0, 0, state.width, state.height);
            ctx.drawImage(canvas, x, y);
            moving.current = { ctx, base, float: canvas, fx: x, fy: y, start: pos, sel, layerId: activeLayerId, frameId: activeFrameId, dx: 0, dy: 0 };
            setMoveOffset({ dx: 0, dy: 0 });
        }
    }, [activeTool, layerCtx, activeFrameId, activeLayerId, selectionRef, state.width, state.height]);

    const move = useCallback((pos: Point) => {
        if (draft?.kind === 'rect') { setDraft({ ...draft, b: pos }); return; }
        if (draft?.kind === 'lasso') {
            const last = draft.pts[draft.pts.length - 1];
            if (last.x !== pos.x || last.y !== pos.y) setDraft({ kind: 'lasso', pts: [...draft.pts, pos] });
            return;
        }
        const m = moving.current;
        if (!m) return;
        let dx = pos.x - m.start.x, dy = pos.y - m.start.y;
        if (gridSnap) { dx = Math.round(dx / gridSize) * gridSize; dy = Math.round(dy / gridSize) * gridSize; }
        if (dx === m.dx && dy === m.dy) return;
        m.dx = dx; m.dy = dy;
        m.ctx.putImageData(m.base, 0, 0);
        m.ctx.drawImage(m.float, m.fx + dx, m.fy + dy);
        p.redrawLayer(m.layerId);
        setMoveOffset({ dx, dy });
    }, [draft, gridSnap, gridSize, p]);

    const up = useCallback(() => {
        if (draft?.kind === 'rect') {
            const same = draft.a.x === draft.b.x && draft.a.y === draft.b.y;
            if (same && !gridSnap) setSelection(null);   // 그냥 클릭 = 선택 해제
            else {
                const [a, b] = gridSnap ? snapRange(draft.a, draft.b, gridSize) : [draft.a, draft.b];
                setSelection(rectSelection(a, b, state.width, state.height));
            }
            setDraft(null);
            return;
        }
        if (draft?.kind === 'lasso') {
            setSelection(draft.pts.length >= 3 ? polygonSelection(draft.pts, state.width, state.height) : null);
            setDraft(null);
            return;
        }
        const m = moving.current;
        if (!m) return;
        moving.current = null;
        setMoveOffset(null);
        if (m.dx !== 0 || m.dy !== 0) {
            p.commitLayerChanges(m.frameId, m.layerId);
            // 레이어 전체를 옮긴 경우(선택 없음)는 선택을 만들지 않음
            if (selectionRef.current) setSelection(shiftSelection(m.sel, m.dx, m.dy));
        } else {
            m.ctx.putImageData(m.base, 0, 0);
            m.ctx.drawImage(m.float, m.fx, m.fy);
            p.redrawLayer(m.layerId);
        }
    }, [draft, gridSnap, gridSize, state.width, state.height, setSelection, selectionRef, p]);

    // ── 편집 ──
    const selectAll = useCallback(() => setSelection(fullSelection(state.width, state.height)), [state.width, state.height, setSelection]);
    const deselect = useCallback(() => setSelection(null), [setSelection]);

    const copy = useCallback((silent = false) => {
        const ctx = layerCtx();
        const sel = selectionRef.current ?? fullSelection(state.width, state.height);
        if (!ctx || !sel) return false;
        clip.current = extractSelection(ctx, sel);
        // 다른 프로그램에서 복사해 둔 이미지가 있으면 붙여넣기 때 그게 우선되므로, 시스템 클립보드를 비워 에디터 복사본이 쓰이게
        navigator.clipboard?.writeText?.('').catch(() => {});
        if (!silent) toast.info('복사했어요.');
        return true;
    }, [layerCtx, selectionRef, state.width, state.height]);

    const removeSelected = useCallback((label: string) => {
        const ctx = layerCtx();
        const sel = selectionRef.current;
        if (!ctx || !activeFrameId || !activeLayerId) return;
        if (!sel) { toast.info('먼저 영역을 선택해 주세요.'); return; }
        clearSelection(ctx, sel);
        p.redrawLayer(activeLayerId);
        p.commitLayerChanges(activeFrameId, activeLayerId);
        if (label) toast.info(label);
    }, [layerCtx, selectionRef, activeFrameId, activeLayerId, p]);

    const cut = useCallback(() => {
        if (!selectionRef.current) { toast.info('먼저 영역을 선택해 주세요.'); return; }
        if (copy(true)) removeSelected('잘라냈어요.');
    }, [copy, removeSelected, selectionRef]);

    /** 에디터 안 복사본을 새 레이어로(같은 자리) → 그 영역 선택 + 이동 도구 */
    const pasteInternal = useCallback(() => {
        const c = clip.current;
        if (!c || !activeFrameId) return false;
        const full = makeCanvas(state.width, state.height);
        full.getContext('2d')!.drawImage(c.canvas, c.x, c.y);
        const pixelData = canvasToPixelData(full);
        if (!pixelData) { toast.info('복사한 영역이 비어 있어요.'); return true; }
        p.addLayer(activeFrameId, { name: '붙여넣기', pixelData });
        setSelection(rectSelection({ x: c.x, y: c.y }, { x: c.x + c.canvas.width - 1, y: c.y + c.canvas.height - 1 }, state.width, state.height));
        setActiveTool('move');
        return true;
    }, [activeFrameId, state.width, state.height, p, setSelection, setActiveTool]);

    /** 메뉴의 붙여넣기: 에디터 복사본 → 없으면 시스템 클립보드 이미지(브라우저가 허락할 때) */
    const paste = useCallback(async () => {
        if (pasteInternal()) return;
        try {
            const items = await navigator.clipboard.read();
            for (const it of items) {
                const type = it.types.find(t => t.startsWith('image/'));
                if (type) { p.importImageFile(new File([await it.getType(type)], 'clipboard.png', { type })); return; }
            }
        } catch { /* 권한 없음·지원 안 함 */ }
        toast.info('붙여넣을 내용이 없어요. 먼저 복사해 주세요.');
    }, [pasteInternal, p]);

    // ── 단축키: Ctrl+A·D·C·X, Delete, Esc / 붙여넣기는 paste 이벤트(시스템 이미지 포함) ──
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (isTyping(e.target) || document.querySelector('[role=dialog]')) return;
            const mod = e.ctrlKey || e.metaKey;
            if (mod && !e.shiftKey && e.code === 'KeyA') { e.preventDefault(); selectAll(); return; }
            if (mod && e.code === 'KeyD') { e.preventDefault(); deselect(); return; }   // 브라우저 즐겨찾기 막기
            if (mod && e.code === 'KeyC') { if (copy()) e.preventDefault(); return; }
            if (mod && e.code === 'KeyX') { e.preventDefault(); cut(); return; }
            if (!mod && (e.code === 'Delete' || e.code === 'Backspace') && selectionRef.current) { e.preventDefault(); removeSelected('지웠어요.'); return; }
            if (e.code === 'Escape' && selectionRef.current) { deselect(); }
        };
        const onPaste = (e: ClipboardEvent) => {
            if (isTyping(e.target) || document.querySelector('[role=dialog]')) return;
            const file = [...(e.clipboardData?.files ?? [])].find(f => f.type.startsWith('image/'));
            if (file) { e.preventDefault(); p.importImageFile(file); return; }
            if (pasteInternal()) e.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('paste', onPaste);
        return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('paste', onPaste); };
    }, [selectAll, deselect, copy, cut, removeSelected, pasteInternal, selectionRef, p]);

    // ── 화면 표시용 ──
    const outline = useMemo(() => {
        if (draft?.kind === 'rect') {
            const [a, b] = gridSnap ? snapRange(draft.a, draft.b, gridSize) : [draft.a, draft.b];
            const s = rectSelection(a, b, state.width, state.height);
            return s ? selectionOutline(s) : '';
        }
        if (!selection) return '';
        const shown = moveOffset ? shiftSelection(selection, moveOffset.dx, moveOffset.dy) : selection;
        return shown ? selectionOutline(shown) : '';
    }, [draft, selection, moveOffset, gridSnap, gridSize, state.width, state.height]);

    const lassoPoints = draft?.kind === 'lasso' ? draft.pts : null;
    const selectionSize = (() => {
        if (draft?.kind === 'rect') return { w: Math.abs(draft.b.x - draft.a.x) + 1, h: Math.abs(draft.b.y - draft.a.y) + 1 };
        if (!selection) return null;
        return { w: selection.bounds.x1 - selection.bounds.x0 + 1, h: selection.bounds.y1 - selection.bounds.y0 + 1 };
    })();

    return {
        selection, outline, lassoPoints, selectionSize, isSelecting: !!draft || !!moving.current,
        down, move, up, selectAll, deselect, copy: () => copy(), cut, paste, deleteSelected: () => removeSelected('지웠어요.'),
    };
}

function ensureCtx(c: HTMLCanvasElement | null) {
    return c?.getContext('2d', { willReadFrequently: true }) ?? null;
}
