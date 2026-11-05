import { useRef, useState } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { CanvasState } from "../../type/editor";
import { toast } from "../../store/toastStore";
import {
    buildSpriteSheet, canvasToBlob, downloadBlob, encodeGif, EXPORT_SCALES, makeZip, MAX_EXPORT_SIDE,
    renderFrames, safeFileName, scaleCanvas, SheetLayout,
} from "../../lib/editorExport";

export type ExportTab = 'image' | 'sheet';

interface ExportModalProps {
    tab: ExportTab;
    onTab: (t: ExportTab) => void;
    onClose: () => void;
    state: CanvasState;
    activeFrameIndex: number;
    projectTitle: string | null;
}

/**
 * 파일 > 이미지 내보내기·스프라이트시트 내보내기 창(PR-C).
 * 이미지: 지금 프레임 PNG 또는 모든 프레임 GIF(프레임별 속도 반영) × 배율.
 * 스프라이트시트: 가로 한 줄·격자 × 배율, JSON을 넣으면 PNG+JSON을 zip 하나로(여러 파일 다운로드 경고 없이).
 */
export function ExportModal({ tab, onTab, onClose, state, activeFrameIndex, projectTitle }: ExportModalProps) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(true, ref, onClose);
    const animated = state.frames.length > 1;
    const [scale, setScale] = useState<number>(state.width <= 64 ? 4 : 1);
    const [format, setFormat] = useState<'png' | 'gif'>(animated ? 'gif' : 'png');
    const [layout, setLayout] = useState<SheetLayout>('row');
    const [withJson, setWithJson] = useState(true);
    const [working, setWorking] = useState(false);

    const n = state.frames.length;
    const cols = tab === 'sheet' ? (layout === 'row' ? n : Math.ceil(Math.sqrt(n))) : 1;
    const rows = tab === 'sheet' ? Math.ceil(n / cols) : 1;
    const outW = state.width * scale * cols, outH = state.height * scale * rows;
    const tooBig = outW > MAX_EXPORT_SIDE || outH > MAX_EXPORT_SIDE;
    const name = safeFileName(projectTitle);

    const run = async () => {
        if (tooBig || working) return;
        setWorking(true);
        try {
            const frames = await renderFrames(state);
            if (tab === 'image') {
                if (format === 'gif' && animated) {
                    downloadBlob(encodeGif(frames.map(f => scaleCanvas(f, scale)), state.frames.map(f => f.duration ?? 100)), `${name}.gif`);
                } else {
                    const f = frames[Math.min(activeFrameIndex, frames.length - 1)];
                    downloadBlob(await canvasToBlob(scaleCanvas(f, scale)), `${name}${scale > 1 ? `_x${scale}` : ''}.png`);
                }
            } else {
                const sheet = buildSpriteSheet(state, frames, scale, layout, name);
                const png = await canvasToBlob(sheet.canvas);
                if (withJson) {
                    const zip = await makeZip([
                        { name: `${name}.png`, data: png },
                        { name: `${name}.json`, data: JSON.stringify(sheet.json, null, 2) },
                    ]);
                    downloadBlob(zip, `${name}_spritesheet.zip`);
                } else {
                    downloadBlob(png, `${name}_spritesheet.png`);
                }
            }
            toast.success('내보내기를 마쳤어요.');
            onClose();
        } catch (e) {
            console.error(e);
            toast.error('내보내기에 실패했어요.');
        } finally {
            setWorking(false);
        }
    };

    const chip = (on: boolean) => ({
        background: on ? 'var(--color-primary)' : 'transparent',
        color: on ? 'var(--color-on-primary)' : 'var(--color-on-surface)',
        borderColor: 'var(--color-outline)',
    });
    const row = "flex items-center gap-3 text-sm";

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="export-title"
                className="w-[460px] max-w-[94vw] rounded-2xl border shadow-2xl p-5 space-y-4"
                style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}>
                <div className="flex items-center justify-between">
                    <h2 id="export-title" className="text-lg font-bold">내보내기</h2>
                    <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-lg hover:bg-surface-container-high">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex gap-1.5">
                    {([['image', '이미지 (PNG·GIF)'], ['sheet', '스프라이트시트']] as const).map(([id, label]) => (
                        <button key={id} type="button" onClick={() => onTab(id)} aria-pressed={tab === id}
                            className="px-3 py-1 rounded-lg border text-xs font-bold" style={chip(tab === id)}>{label}</button>
                    ))}
                </div>

                <div className="space-y-3">
                    {tab === 'image' && (
                        <div className={row}>
                            <span className="w-16">형식</span>
                            <button type="button" onClick={() => setFormat('png')} aria-pressed={format === 'png'}
                                className="px-2 py-1 rounded border text-xs font-bold" style={chip(format === 'png')}>PNG (지금 프레임)</button>
                            <button type="button" onClick={() => setFormat('gif')} aria-pressed={format === 'gif'} disabled={!animated}
                                title={animated ? '' : '프레임이 2개 이상일 때 GIF로 내보낼 수 있어요'}
                                className="px-2 py-1 rounded border text-xs font-bold disabled:opacity-40" style={chip(format === 'gif' && animated)}>GIF (모든 프레임)</button>
                        </div>
                    )}
                    {tab === 'sheet' && (<>
                        <div className={row}>
                            <span className="w-16">배치</span>
                            <button type="button" onClick={() => setLayout('row')} aria-pressed={layout === 'row'}
                                className="px-2 py-1 rounded border text-xs font-bold" style={chip(layout === 'row')}>가로 한 줄</button>
                            <button type="button" onClick={() => setLayout('grid')} aria-pressed={layout === 'grid'}
                                className="px-2 py-1 rounded border text-xs font-bold" style={chip(layout === 'grid')}>격자</button>
                        </div>
                        <label className={row}>
                            <span className="w-16">데이터</span>
                            <input type="checkbox" className="accent-primary" checked={withJson} onChange={e => setWithJson(e.target.checked)} />
                            <span>JSON 함께(프레임 위치·속도·태그, zip으로 묶음)</span>
                        </label>
                    </>)}
                    <div className={row}>
                        <span className="w-16">배율</span>
                        {EXPORT_SCALES.map(s => (
                            <button key={s} type="button" onClick={() => setScale(s)} aria-pressed={scale === s}
                                className="px-2 py-1 rounded border text-xs font-bold" style={chip(scale === s)}>×{s}</button>
                        ))}
                    </div>
                    <p className="text-xs" style={{ color: tooBig ? 'var(--color-warning)' : 'var(--color-on-surface-variant)' }}>
                        결과 크기 {outW}×{outH}px{tab === 'sheet' ? ` · 프레임 ${n}개` : ''}
                        {tooBig ? ` — 한 변이 ${MAX_EXPORT_SIDE}px을 넘어 배율을 낮춰 주세요.` : ' · 칸을 흐림 없이 그대로 키워요.'}
                    </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-outline)' }}>
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--color-outline)' }}>취소</button>
                    <button type="button" onClick={run} disabled={tooBig || working}
                        className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                        style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                        {working ? '만드는 중…' : '내보내기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
