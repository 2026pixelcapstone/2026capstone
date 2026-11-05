import { useEffect, useRef, useState } from "react";
import { FrameData } from "../../type/editor";
import { getCacheKey } from "../../utils/editorUtils";

type PreviewMode = 'normal' | 'silhouette' | 'value' | 'tile';

interface ReadabilityPreviewProps {
    frame: FrameData;
    width: number;
    height: number;
    peekLayerCanvas: (cacheKey: string) => HTMLCanvasElement | null;
    onClose: () => void;
    initialMode?: 'normal' | 'tile';
}

const MODES: { id: PreviewMode; label: string; hint: string }[] = [
    { id: 'normal', label: '원본', hint: '실제 크기로 보기' },
    { id: 'silhouette', label: '실루엣', hint: '칠한 칸을 모두 검정으로 — 형태가 읽히는지' },
    { id: 'value', label: '명도', hint: '흑백으로 — 밝고 어두움이 구분되는지' },
    { id: 'tile', label: '타일', hint: '3×3으로 이어 붙여 — 바닥·벽 타일 이음새가 자연스러운지(PR-D)' },
];
const SCALES = [1, 2, 4] as const;
const MAX_BOX = 240;   // 큰 캔버스는 이 크기 안에 맞춰 보여 줌(그림은 그대로)

/**
 * 가독성 미리보기(PR-A) — 지금 프레임을 작은 창에 원본·실루엣·명도로 보여 줌.
 * 픽셀아트는 실제 크기에서 형태가 읽히는지가 중요해서 그리면서 바로 확인하는 용도. 그림 데이터는 바꾸지 않음.
 * 그리는 중에는 레이어 캐시만 바뀌고 상태는 그대로라 짧은 주기로 다시 그림(창이 열려 있을 때만).
 */
export function ReadabilityPreview({ frame, width, height, peekLayerCanvas, onClose, initialMode = 'normal' }: ReadabilityPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mode, setMode] = useState<PreviewMode>(initialMode);
    const [scale, setScale] = useState<number>(width <= 32 ? 4 : width <= 64 ? 2 : 1);

    useEffect(() => {
        const draw = () => {
            const cv = canvasRef.current;
            const ctx = cv?.getContext('2d', { willReadFrequently: true });
            if (!cv || !ctx) return;
            const k = mode === 'tile' ? 3 : 1;
            if (cv.width !== width * k || cv.height !== height * k) { cv.width = width * k; cv.height = height * k; }
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.imageSmoothingEnabled = false;
            const layers = [...frame.layers].sort((a, b) => a.layerOrder - b.layerOrder);
            for (const layer of layers) {
                if (!layer.isVisible || !layer.opacity) continue;
                const src = peekLayerCanvas(getCacheKey(frame.id, layer.id));
                if (!src) continue;
                ctx.globalAlpha = layer.opacity / 100;
                ctx.drawImage(src, 0, 0);
            }
            ctx.globalAlpha = 1;
            if (mode === 'tile') {
                // 한 장을 그린 뒤 그 칸을 8번 더 복사(타일처럼 이어 붙임)
                for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) {
                    if (tx || ty) ctx.drawImage(cv, 0, 0, width, height, tx * width, ty * height, width, height);
                }
            } else if (mode === 'silhouette') {
                ctx.globalCompositeOperation = 'source-in';   // 칠한 칸(알파)만 남기고 색을 검정으로
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);
                ctx.globalCompositeOperation = 'source-over';
            } else if (mode === 'value') {
                const img = ctx.getImageData(0, 0, width, height);
                const d = img.data;
                for (let i = 0; i < d.length; i += 4) {
                    // 사람 눈 밝기(Rec. 709 가중치)
                    const v = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
                    d[i] = d[i + 1] = d[i + 2] = v;
                }
                ctx.putImageData(img, 0, 0);
            }
        };
        draw();
        const id = window.setInterval(draw, 150);
        return () => window.clearInterval(id);
    }, [frame, width, height, peekLayerCanvas, mode]);

    const k = mode === 'tile' ? 3 : 1;
    const fit = Math.min(1, MAX_BOX / Math.max(width * k * scale, height * k * scale));
    const btn = (on: boolean) => ({
        background: on ? 'var(--color-primary)' : 'transparent',
        color: on ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
        borderColor: 'var(--color-outline)',
    });

    return (
        <div className="absolute top-4 left-4 z-30 rounded-xl border shadow-lg p-3 space-y-2"
            style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}
            onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold">미리보기</span>
                <button type="button" onClick={onClose} aria-label="미리보기 닫기"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high">
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>
            <div className="flex gap-1">
                {MODES.map(m => (
                    <button key={m.id} type="button" title={m.hint} onClick={() => setMode(m.id)}
                        className="px-2 py-0.5 rounded border text-[11px] font-bold" style={btn(mode === m.id)}>{m.label}</button>
                ))}
            </div>
            <div className="flex items-center justify-center rounded"
                style={{ minWidth: 96, minHeight: 64, background: mode === 'silhouette' ? '#ffffff' : '#e8e8e8' }}>
                <canvas ref={canvasRef}
                    style={{ width: width * k * scale * fit, height: height * k * scale * fit, imageRendering: 'pixelated' }} />
            </div>
            <div className="flex items-center gap-1">
                {SCALES.map(s => (
                    <button key={s} type="button" onClick={() => setScale(s)}
                        className="px-2 py-0.5 rounded border text-[11px] font-bold" style={btn(scale === s)}>{s}×</button>
                ))}
                {fit < 1 && <span className="text-[10px] ml-1" style={{ color: 'var(--color-on-surface-variant)' }}>창에 맞춤</span>}
            </div>
        </div>
    );
}
