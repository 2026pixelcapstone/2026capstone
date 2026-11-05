import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { CanvasState } from "../../type/editor";
import { renderFrames } from "../../lib/editorExport";

interface GamePreviewModalProps {
    state: CanvasState;
    onClose: () => void;
}

type Bg = 'checker' | 'sky' | 'tile';

const VIEW_W = 480, VIEW_H = 270;   // 16:9 게임 화면(실제 픽셀), 화면에는 CSS로 키움
const GROUND = 0.78;                // 발이 닿는 높이(화면 높이 비율)

/**
 * 게임 미리보기(PR-D) — 내 애니메이션을 게임 화면처럼 배경 위에서 재생.
 * ←·→로 걸어가고(왼쪽이면 좌우 반전), '자동 걷기'면 끝에서 돌아옴. 배경은 체크무늬·하늘·내 타일 이미지(반복).
 * 프레임별 속도(duration)를 그대로 써서 에디터 재생과 같음. 그림은 바꾸지 않음.
 */
export function GamePreviewModal({ state, onClose }: GamePreviewModalProps) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(true, ref, onClose);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [frames, setFrames] = useState<HTMLCanvasElement[]>([]);
    const [bg, setBg] = useState<Bg>('sky');
    const [tile, setTile] = useState<HTMLImageElement | null>(null);
    const [autoWalk, setAutoWalk] = useState(true);
    const [speed, setSpeed] = useState(1);
    const keys = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
    const tileUrl = useRef<string | null>(null);

    // 스프라이트 크기: 화면 높이의 1/3 안팎이 되도록 정수 배율
    const scale = Math.max(1, Math.floor((VIEW_H / 3) / Math.max(1, state.height)));

    useEffect(() => {
        let alive = true;
        renderFrames(state).then(f => { if (alive) setFrames(f); }).catch(() => { if (alive) setFrames([]); });
        return () => { alive = false; };
    }, [state]);
    useEffect(() => () => { if (tileUrl.current) URL.revokeObjectURL(tileUrl.current); }, []);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.code === 'ArrowLeft') { keys.current.left = true; e.preventDefault(); }
            if (e.code === 'ArrowRight') { keys.current.right = true; e.preventDefault(); }
        };
        const up = (e: KeyboardEvent) => {
            if (e.code === 'ArrowLeft') keys.current.left = false;
            if (e.code === 'ArrowRight') keys.current.right = false;
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    }, []);

    useEffect(() => {
        const cv = canvasRef.current;
        const ctx = cv?.getContext('2d');
        if (!cv || !ctx || frames.length === 0) return;
        ctx.imageSmoothingEnabled = false;
        const sw = state.width * scale, sh = state.height * scale;
        let x = (VIEW_W - sw) / 2, dir = 1, fi = 0, acc = 0, last = performance.now(), raf = 0;
        const durations = state.frames.map(f => Math.max(20, f.duration ?? 100));

        const drawBg = () => {
            if (bg === 'sky') {
                const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
                g.addColorStop(0, '#7dd3fc'); g.addColorStop(1, '#e0f2fe');
                ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
                ctx.fillStyle = '#65a30d'; ctx.fillRect(0, VIEW_H * GROUND, VIEW_W, VIEW_H);
                ctx.fillStyle = '#3f6212'; ctx.fillRect(0, VIEW_H * GROUND, VIEW_W, 3);
            } else if (bg === 'tile' && tile) {
                const tw = tile.naturalWidth * scale, th = tile.naturalHeight * scale;
                for (let ty = 0; ty < VIEW_H; ty += th) for (let tx = 0; tx < VIEW_W; tx += tw) ctx.drawImage(tile, tx, ty, tw, th);
            } else {
                for (let ty = 0; ty < VIEW_H; ty += 16) for (let tx = 0; tx < VIEW_W; tx += 16) {
                    ctx.fillStyle = ((tx + ty) / 16) % 2 ? '#d4d4d8' : '#f4f4f5';
                    ctx.fillRect(tx, ty, 16, 16);
                }
            }
        };

        const tick = (now: number) => {
            const dt = Math.min(100, now - last);
            last = now;
            acc += dt;
            while (acc >= durations[fi % durations.length]) { acc -= durations[fi % durations.length]; fi = (fi + 1) % frames.length; }
            const step = speed * dt * 0.06 * scale;   // 대략 배율 1에서 초당 60px
            if (keys.current.left || keys.current.right) {
                dir = keys.current.right ? 1 : -1;
                x += dir * step;
            } else if (autoWalk) {
                x += dir * step;
                if (x < 0) { x = 0; dir = 1; }
                if (x > VIEW_W - sw) { x = VIEW_W - sw; dir = -1; }
            }
            x = Math.max(0, Math.min(VIEW_W - sw, x));
            drawBg();
            const y = Math.round(VIEW_H * GROUND - sh);
            ctx.save();
            if (dir < 0) { ctx.translate(Math.round(x) + sw, y); ctx.scale(-1, 1); ctx.drawImage(frames[fi], 0, 0, sw, sh); }
            else ctx.drawImage(frames[fi], Math.round(x), y, sw, sh);
            ctx.restore();
            raf = requestAnimationFrame(tick);
        };
        tick(last);   // 첫 장면은 바로(탭이 백그라운드여도 빈 화면으로 남지 않게), 이후 매 프레임
        return () => cancelAnimationFrame(raf);
    }, [frames, bg, tile, autoWalk, speed, scale, state.width, state.height, state.frames]);

    const loadTile = (file: File) => {
        if (tileUrl.current) URL.revokeObjectURL(tileUrl.current);
        const url = URL.createObjectURL(file);
        tileUrl.current = url;
        const img = new Image();
        img.onload = () => { setTile(img); setBg('tile'); };
        img.src = url;
    };

    const chip = (on: boolean) => ({
        background: on ? 'var(--color-primary)' : 'transparent',
        color: on ? 'var(--color-on-primary)' : 'var(--color-on-surface)',
        borderColor: 'var(--color-outline)',
    });

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="game-preview-title"
                className="rounded-2xl border shadow-2xl p-5 space-y-3 max-w-[96vw]"
                style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}>
                <div className="flex items-center justify-between gap-6">
                    <h2 id="game-preview-title" className="text-lg font-bold">게임 미리보기</h2>
                    <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-lg hover:bg-surface-container-high">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="rounded-lg block"
                    style={{ width: 'min(960px, 90vw)', aspectRatio: '16 / 9', imageRendering: 'pixelated', background: '#000' }} />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold mr-1">배경</span>
                    {([['sky', '하늘·땅'], ['checker', '체크무늬']] as const).map(([id, label]) => (
                        <button key={id} type="button" onClick={() => setBg(id)} aria-pressed={bg === id}
                            className="px-2 py-1 rounded border font-bold" style={chip(bg === id)}>{label}</button>
                    ))}
                    <label className="px-2 py-1 rounded border font-bold cursor-pointer" style={chip(bg === 'tile')}>
                        내 타일 이미지…
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) loadTile(f); }} />
                    </label>
                    <span className="mx-2 h-4 w-px" style={{ background: 'var(--color-outline)' }} />
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" className="accent-primary" checked={autoWalk} onChange={e => setAutoWalk(e.target.checked)} />
                        자동 걷기
                    </label>
                    <label className="flex items-center gap-1.5">
                        속도
                        <input type="range" min={0} max={3} step={0.5} value={speed} onChange={e => setSpeed(Number(e.target.value))} className="w-20 accent-primary" />
                    </label>
                    <span style={{ color: 'var(--color-on-surface-variant)' }}>← → 키로 걷기 · 스프라이트 ×{scale}</span>
                </div>
            </div>
        </div>
    );
}
