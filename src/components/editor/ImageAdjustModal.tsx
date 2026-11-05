import { useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { OpScope } from "../../hooks/editor/useImageOps";
import {
    addOutline, adjustHsb, grayscale, HsbAdjust, invertColors, OutlineOptions, replaceColor, snapToPalette, usedColors,
} from "../../utils/pixelOps";

export type AdjustTab = 'hsb' | 'invert' | 'gray' | 'palette' | 'outline' | 'replace';

export const ADJUST_TABS: { id: AdjustTab; label: string }[] = [
    { id: 'hsb', label: '색조·채도·밝기' },
    { id: 'invert', label: '색 반전' },
    { id: 'gray', label: '흑백' },
    { id: 'palette', label: '팔레트로 맞추기' },
    { id: 'outline', label: '외곽선' },
    { id: 'replace', label: '색 바꾸기' },
];

const SCOPES: { id: OpScope; label: string }[] = [
    { id: 'layer', label: '지금 레이어' },
    { id: 'frame', label: '지금 프레임' },
    { id: 'all', label: '모든 프레임' },
];

interface ImageAdjustModalProps {
    tab: AdjustTab;
    onTab: (t: AdjustTab) => void;
    onClose: () => void;
    palette: string[];
    fgColor: string;
    busy: boolean;
    loadPreviewSource: () => Promise<HTMLCanvasElement | null>;
    onApply: (label: string, scope: OpScope, fn: (c: HTMLCanvasElement) => HTMLCanvasElement) => Promise<boolean>;
}

/**
 * 이미지 > 색 조정 창(PR-B). 탭마다 설정 → 지금 레이어로 전·후 미리보기 → 범위(레이어·프레임·모든 프레임) 골라 적용.
 * 적용은 되돌리기 한 번에 통째로 돌아감(useImageOps).
 */
export function ImageAdjustModal({ tab, onTab, onClose, palette, fgColor, busy, loadPreviewSource, onApply }: ImageAdjustModalProps) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(true, ref, onClose);
    const [scope, setScope] = useState<OpScope>('layer');
    const [hsb, setHsb] = useState<HsbAdjust>({ hue: 0, saturation: 0, brightness: 0 });
    const [outline, setOutline] = useState<OutlineOptions>({ color: fgColor, placement: 'outside', diagonal: false });
    const [from, setFrom] = useState<string | null>(null);
    const [to, setTo] = useState<string>(fgColor);
    const [source, setSource] = useState<HTMLCanvasElement | null>(null);
    const beforeRef = useRef<HTMLCanvasElement>(null);
    const afterRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let alive = true;
        loadPreviewSource().then(c => { if (alive) setSource(c); }).catch(() => { if (alive) setSource(null); });
        return () => { alive = false; };
    }, [loadPreviewSource]);

    const colors = useMemo(() => (source ? usedColors(source) : []), [source]);

    /** 지금 탭 설정으로 만든 변환 */
    const fn = useMemo<((c: HTMLCanvasElement) => HTMLCanvasElement) | null>(() => {
        switch (tab) {
            case 'hsb': return c => adjustHsb(c, hsb);
            case 'invert': return invertColors;
            case 'gray': return grayscale;
            case 'palette': return palette.length ? (c => snapToPalette(c, palette)) : null;
            case 'outline': return c => addOutline(c, outline);
            case 'replace': return from ? (c => replaceColor(c, from, to)) : null;
        }
    }, [tab, hsb, palette, outline, from, to]);

    // 전·후 미리보기(지금 레이어)
    useEffect(() => {
        const draw = (cv: HTMLCanvasElement | null, img: HTMLCanvasElement | null) => {
            if (!cv) return;
            const ctx = cv.getContext('2d');
            if (!ctx) return;
            cv.width = img?.width ?? 1;
            cv.height = img?.height ?? 1;
            ctx.clearRect(0, 0, cv.width, cv.height);
            if (img) ctx.drawImage(img, 0, 0);
        };
        draw(beforeRef.current, source);
        draw(afterRef.current, source && fn ? fn(source) : source);
    }, [source, fn]);

    const label = ADJUST_TABS.find(t => t.id === tab)?.label ?? '색 조정';
    const apply = async () => {
        if (!fn) return;
        if (await onApply(label, scope, fn)) onClose();
    };

    // 비율을 지키며 160px 상자에 맞춤
    const ar = (source?.width ?? 1) / (source?.height ?? 1);
    const previewStyle = { width: ar >= 1 ? 160 : 160 * ar, height: ar >= 1 ? 160 / ar : 160, imageRendering: 'pixelated' as const, background: '#e8e8e8' };
    const chip = (on: boolean) => ({
        background: on ? 'var(--color-primary)' : 'transparent',
        color: on ? 'var(--color-on-primary)' : 'var(--color-on-surface)',
        borderColor: 'var(--color-outline)',
    });
    const slider = (key: keyof HsbAdjust, text: string, min: number, max: number) => (
        <label className="flex items-center gap-3 text-sm">
            <span className="w-12 shrink-0">{text}</span>
            <input type="range" min={min} max={max} value={hsb[key]} className="flex-1 accent-primary"
                onChange={e => setHsb(v => ({ ...v, [key]: Number(e.target.value) }))} />
            <span className="w-10 text-right font-mono text-xs">{hsb[key]}</span>
        </label>
    );

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="image-adjust-title"
                className="w-[560px] max-w-[94vw] rounded-2xl border shadow-2xl p-5 space-y-4"
                style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}>
                <div className="flex items-center justify-between">
                    <h2 id="image-adjust-title" className="text-lg font-bold">이미지 조정</h2>
                    <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-lg hover:bg-surface-container-high">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {ADJUST_TABS.map(t => (
                        <button key={t.id} type="button" onClick={() => onTab(t.id)} aria-pressed={tab === t.id}
                            className="px-3 py-1 rounded-lg border text-xs font-bold" style={chip(tab === t.id)}>{t.label}</button>
                    ))}
                </div>

                <div className="min-h-[88px] space-y-3">
                    {tab === 'hsb' && (<>
                        {slider('hue', '색조', -180, 180)}
                        {slider('saturation', '채도', -100, 100)}
                        {slider('brightness', '밝기', -100, 100)}
                    </>)}
                    {tab === 'invert' && <p className="text-sm">칠한 칸의 색을 반대 색으로 바꿔요(투명한 칸은 그대로).</p>}
                    {tab === 'gray' && <p className="text-sm">칠한 칸을 밝기만 남긴 회색으로 바꿔요.</p>}
                    {tab === 'palette' && (
                        <div className="space-y-2">
                            <p className="text-sm">팔레트에 없는 색을 지금 팔레트에서 가장 가까운 색으로 바꿔요(눈에 보이는 색 차이 기준).</p>
                            <div className="flex flex-wrap gap-1">
                                {palette.map(c => <span key={c} className="w-5 h-5 rounded border" style={{ background: c, borderColor: 'var(--color-outline)' }} title={c} />)}
                            </div>
                        </div>
                    )}
                    {tab === 'outline' && (
                        <div className="space-y-2 text-sm">
                            <label className="flex items-center gap-3">
                                <span className="w-12">색</span>
                                <input type="color" value={outline.color} onChange={e => setOutline(o => ({ ...o, color: e.target.value }))} />
                                <span className="font-mono text-xs">{outline.color}</span>
                            </label>
                            <div className="flex items-center gap-3">
                                <span className="w-12">위치</span>
                                {(['outside', 'inside'] as const).map(p => (
                                    <button key={p} type="button" onClick={() => setOutline(o => ({ ...o, placement: p }))}
                                        className="px-2 py-0.5 rounded border text-xs font-bold" style={chip(outline.placement === p)}>
                                        {p === 'outside' ? '바깥(둘레 빈 칸)' : '안쪽(가장자리 칸)'}
                                    </button>
                                ))}
                            </div>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" className="accent-primary" checked={outline.diagonal}
                                    onChange={e => setOutline(o => ({ ...o, diagonal: e.target.checked }))} />
                                대각선 칸까지(두꺼운 외곽선)
                            </label>
                        </div>
                    )}
                    {tab === 'replace' && (
                        <div className="space-y-2 text-sm">
                            <p>바꿀 색(지금 레이어에 쓰인 색)</p>
                            <div className="flex flex-wrap gap-1">
                                {colors.length === 0 && <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>지금 레이어에 칠한 칸이 없어요.</span>}
                                {colors.map(c => (
                                    <button key={c} type="button" title={c} aria-label={`바꿀 색 ${c}`} aria-pressed={from === c} onClick={() => setFrom(c)}
                                        className="w-6 h-6 rounded border-2" style={{ background: c, borderColor: from === c ? 'var(--color-primary)' : 'var(--color-outline)' }} />
                                ))}
                            </div>
                            <label className="flex items-center gap-3">
                                <span>새 색</span>
                                <input type="color" value={to} onChange={e => setTo(e.target.value)} />
                                <span className="font-mono text-xs">{to}</span>
                            </label>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-center gap-6">
                    <figure className="text-center text-xs space-y-1">
                        <canvas ref={beforeRef} style={previewStyle} className="rounded border" />
                        <figcaption>지금</figcaption>
                    </figure>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)' }}>arrow_forward</span>
                    <figure className="text-center text-xs space-y-1">
                        <canvas ref={afterRef} style={previewStyle} className="rounded border" />
                        <figcaption>적용 후(지금 레이어)</figcaption>
                    </figure>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: 'var(--color-outline)' }}>
                    <div className="flex items-center gap-1 text-xs">
                        <span className="mr-1">적용 범위</span>
                        {SCOPES.map(s => (
                            <button key={s.id} type="button" onClick={() => setScope(s.id)} aria-pressed={scope === s.id}
                                className="px-2 py-1 rounded border font-bold" style={chip(scope === s.id)}>{s.label}</button>
                        ))}
                    </div>
                    <button type="button" onClick={apply} disabled={!fn || busy}
                        className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                        style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                        {busy ? '적용 중…' : '적용'}
                    </button>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>잠긴 레이어는 바뀌지 않아요. Ctrl+Z로 한 번에 되돌릴 수 있어요.</p>
            </div>
        </div>
    );
}
