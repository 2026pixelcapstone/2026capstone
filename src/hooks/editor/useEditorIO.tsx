import { DEFAULT_PROJECT_TITLE } from '../../constants/editor/editor';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { CanvasState, LayerData } from "../../type/editor";
import { MAX_CANVAS_SIZE } from "../../constants/editor/editor";
import { toast } from "../../store/toastStore";
import { canvasToPixelData, loadPixelData, makeCanvas } from "../../utils/pixelOps";
import { canvasDataToPpit } from "../../utils/ppitConvert";
import { serializePpit } from "../../lib/ppit";
import { buildSpriteSheet, canvasToBlob, encodeGif, makeZip, renderFrames, safeFileName, scaleCanvas } from "../../lib/editorExport";
import { putAssetDraft } from "../../lib/editorHandoff";

interface UseEditorIO {
    state: CanvasState;
    activeFrameId: string | null;
    setActiveLayerId: React.Dispatch<React.SetStateAction<string | null>>;
    runEdit: (label: string, compute: (snap: CanvasState) => Promise<CanvasState | null>) => Promise<boolean>;
    projectTitle: string | null;
    paletteColors: string[];
    fps: number;
}

const IMPORT_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp';
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

function loadImageFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했어요.')); };
        img.src = url;
    });
}

/**
 * 파일 메뉴의 들어오고 나가기(PR-C): 이미지 불러오기(새 레이어)·참조 이미지·갤러리 공유(.ppit 만들어 등록 창)·에셋 스토어 등록(새 탭).
 */
export function useEditorIO({ state, activeFrameId, setActiveLayerId, runEdit, projectTitle, paletteColors, fps }: UseEditorIO) {
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const referenceInputRef = useRef<HTMLInputElement | null>(null);

    // ── 이미지 불러오기 → 지금 프레임에 새 레이어 ──
    const importImageFile = useCallback(async (file: File) => {
        if (file.size > MAX_IMPORT_BYTES) { toast.error('10MB 이하 이미지만 불러올 수 있어요.'); return; }
        let img: HTMLImageElement;
        try { img = await loadImageFile(file); } catch { toast.error('이미지를 읽지 못했어요(PNG·JPG·GIF·WebP).'); return; }
        const W = state.width, H = state.height, iw = img.naturalWidth, ih = img.naturalHeight;
        // 캔버스보다 크면: 최대 크기 안이면 캔버스를 키울지 묻고, 아니면(또는 거절) 캔버스에 맞게 줄임(칸 그대로 — 흐림 없음)
        let mode: 'fit-in' | 'grow' | 'shrink' = 'fit-in';
        if (iw > W || ih > H) {
            const nw = Math.max(W, iw), nh = Math.max(H, ih);
            if (nw <= MAX_CANVAS_SIZE && nh <= MAX_CANVAS_SIZE
                && window.confirm(`이미지(${iw}×${ih})가 캔버스(${W}×${H})보다 커요.\n캔버스를 ${nw}×${nh}로 키울까요?\n취소하면 캔버스 크기에 맞게 줄여서 넣어요.`)) mode = 'grow';
            else mode = 'shrink';
        }
        const frameId = activeFrameId;
        const newId = `layer-${crypto.randomUUID().slice(0, 8)}`;
        const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || '불러온 이미지';
        const ok = await runEdit('이미지 불러오기', async (snap) => {
            const f = snap.frames.find(x => x.id === frameId);
            if (!f) return null;
            const nw = mode === 'grow' ? Math.max(snap.width, iw) : snap.width;
            const nh = mode === 'grow' ? Math.max(snap.height, ih) : snap.height;
            const layerCanvas = makeCanvas(nw, nh);
            const ctx = layerCanvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = false;
            if (mode === 'shrink') {
                const s = Math.min(nw / iw, nh / ih);
                ctx.drawImage(img, 0, 0, Math.max(1, Math.round(iw * s)), Math.max(1, Math.round(ih * s)));
            } else {
                ctx.drawImage(img, 0, 0);
            }
            const newLayer: LayerData = {
                id: newId, name, layerOrder: f.layers.length, blendMode: 'NORMAL', isLocked: false, isVisible: true,
                opacity: 100, color: '#818cf8', pixelData: canvasToPixelData(layerCanvas),
            };
            // 캔버스를 키우면 기존 레이어도 새 크기로 다시 저장(왼쪽 위 기준) — 작은 그림이 늘어나 보이는 것 방지
            const frames = mode === 'grow'
                ? await Promise.all(snap.frames.map(async fr => ({
                    ...fr,
                    layers: await Promise.all(fr.layers.map(async l => {
                        const src = await loadPixelData(l.pixelData, snap.width, snap.height);
                        if (!src) return l;
                        const c = makeCanvas(nw, nh);
                        c.getContext('2d')!.drawImage(src, 0, 0);
                        return { ...l, pixelData: canvasToPixelData(c) };
                    })),
                })))
                : snap.frames;
            return {
                ...snap, width: nw, height: nh,
                frames: frames.map(fr => (fr.id === f.id ? { ...fr, layers: [...fr.layers, newLayer] } : fr)),
            };
        });
        if (ok) {
            setActiveLayerId(newId);
            toast.success(mode === 'shrink' ? '캔버스에 맞게 줄여서 새 레이어로 넣었어요.' : '새 레이어로 넣었어요.');
        }
    }, [state.width, state.height, activeFrameId, runEdit, setActiveLayerId]);

    const openImageImport = useCallback(() => imageInputRef.current?.click(), []);

    // ── 참조 이미지(그림에 안 들어감, 저장 안 됨) ──
    const [reference, setReference] = useState<{ url: string; name: string } | null>(null);
    const [referenceOpacity, setReferenceOpacity] = useState(40);
    const [referenceFront, setReferenceFront] = useState(true);
    const [referenceVisible, setReferenceVisible] = useState(true);
    const refUrl = useRef<string | null>(null);
    useEffect(() => () => { if (refUrl.current) URL.revokeObjectURL(refUrl.current); }, []);

    const setReferenceFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 참조로 쓸 수 있어요.'); return; }
        if (refUrl.current) URL.revokeObjectURL(refUrl.current);
        const url = URL.createObjectURL(file);
        refUrl.current = url;
        setReference({ url, name: file.name });
        setReferenceVisible(true);
    }, []);
    const closeReference = useCallback(() => {
        if (refUrl.current) URL.revokeObjectURL(refUrl.current);
        refUrl.current = null;
        setReference(null);
    }, []);
    const openReference = useCallback(() => referenceInputRef.current?.click(), []);

    // ── 갤러리 공유: 지금 그림을 .ppit로 → 전용 갤러리 등록 창 ──
    const buildPpitFile = useCallback(() => {
        const ppit = canvasDataToPpit(state, paletteColors, fps);
        return new File([serializePpit(ppit)], `${safeFileName(projectTitle)}.ppit`, { type: 'application/json' });
    }, [state, paletteColors, fps, projectTitle]);

    // ── 에셋 스토어 등록: 묶음(zip)·미리보기를 만들어 새 탭의 등록 페이지로 ──
    const registerAsset = useCallback(async () => {
        // 팝업 차단을 피하려고 클릭 직후 빈 탭부터 엶(파일 만드는 동안 기다리면 차단됨)
        const win = window.open('about:blank', '_blank');
        try {
            const name = safeFileName(projectTitle);
            const frames = await renderFrames(state);
            const animated = frames.length > 1;
            const previewScale = Math.max(1, Math.min(8, Math.floor(256 / Math.max(state.width, state.height))));
            const preview = animated
                ? new File([encodeGif(frames.map(f => scaleCanvas(f, previewScale)), state.frames.map(f => f.duration ?? 100))], `${name}_preview.gif`, { type: 'image/gif' })
                : new File([await canvasToBlob(scaleCanvas(frames[0], previewScale))], `${name}_preview.png`, { type: 'image/png' });
            const files: { name: string; data: Blob | string }[] = [{ name: `${name}.ppit`, data: buildPpitFile() }];
            if (animated) {
                const sheet = buildSpriteSheet(state, frames, 1, 'row', name);
                files.push({ name: `${name}.png`, data: await canvasToBlob(sheet.canvas) });
                files.push({ name: `${name}.json`, data: JSON.stringify(sheet.json, null, 2) });
            } else {
                files.push({ name: `${name}.png`, data: await canvasToBlob(frames[0]) });
            }
            const zip = await makeZip(files);
            const id = await putAssetDraft({
                title: projectTitle && projectTitle !== 'Untitled Project' && projectTitle !== DEFAULT_PROJECT_TITLE ? projectTitle : '',
                preview,
                bundle: new File([zip], `${name}.zip`, { type: 'application/zip' }),
                createdAt: Date.now(),
            });
            const url = `/assets/create?draft=${id}`;
            if (win) win.location.href = url;
            else if (window.confirm('새 탭을 열지 못했어요(팝업 차단). 이 탭에서 에셋 등록으로 이동할까요?\n저장하지 않은 작업은 사라져요.')) window.location.href = url;
        } catch (e) {
            console.error(e);
            win?.close();
            toast.error('에셋 파일을 만들지 못했어요.');
        }
    }, [state, projectTitle, buildPpitFile]);

    const fileInputs = (
        <>
            <input ref={imageInputRef} type="file" accept={IMPORT_ACCEPT} className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importImageFile(f); }} />
            <input ref={referenceInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setReferenceFile(f); }} />
        </>
    );

    return {
        fileInputs, openImageImport, importImageFile, openReference,
        reference, referenceOpacity, setReferenceOpacity, referenceFront, setReferenceFront, referenceVisible, setReferenceVisible, closeReference,
        buildPpitFile, registerAsset,
    };
}
