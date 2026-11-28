import { projectResources } from '../../utils/editorResources';
import { detectSpriteRegions, type SpriteRegion } from '../../utils/spritesheet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { createDefaultLayer, MAX_CANVAS_SIZE, MAX_PROJECT_FRAMES, MAX_PROJECT_PIXELS } from '../../constants/editor/editor';
import type { CanvasState } from '../../type/editor';
import { canvasToPixelData, makeCanvas } from '../../utils/pixelOps';
import { toast } from '../../store/toastStore';

interface Props {
    current: CanvasState;
    initialWidth: number;
    initialHeight: number;
    initialFps: number;
    onClose: () => void;
    onImport: (state: CanvasState) => Promise<boolean>;
}

// PNG data URLs and history grow with the number of decoded pixels.
const MAX_FRAMES = MAX_PROJECT_FRAMES;
const MAX_PIXELS = 16 * 1024 * 1024;

export function ImportSpritesheet({ current, initialWidth, initialHeight, initialFps, onClose, onImport }: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef(0);
    
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [pixels, setPixels] = useState<ImageData | null>(null);
    const [detected, setDetected] = useState<SpriteRegion[]>([]);
    const [autoSplit, setAutoSplit] = useState(false);
    const [trim, setTrim] = useState(false);
    const [skipEmpty, setSkipEmpty] = useState(true);
    const [filename, setFilename] = useState('');
    const [width, setWidth] = useState(initialWidth);
    const [height, setHeight] = useState(initialHeight);
    const [fps, setFps] = useState(initialFps);
    const [requestedCount, setCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [working, setWorking] = useState(false);
    const [fileError, setFileError] = useState('');

    const close = () => { if (!working) onClose(); };
    useFocusTrap(true, dialogRef, close);
    useEffect(() => () => { requestRef.current += 1; }, []);

    
    const validSize = Number.isInteger(width) && Number.isInteger(height)
        && width >= 1 && height >= 1 && width <= MAX_CANVAS_SIZE && height <= MAX_CANVAS_SIZE;
    
    const bounds = useMemo(() => {
        if (!pixels) return { x: 0, y: 0, width: 0, height: 0 };
        if (!trim) return { x: 0, y: 0, width: pixels.width, height: pixels.height };

        let left = pixels.width
        let top = pixels.height 
        let right = -1
        let bottom = -1;

        for (let y = 0; y < pixels.height; y++){
            for (let x = 0; x < pixels.width; x++) {
                if (pixels.data[(y * pixels.width + x) * 4 + 3] === 0) continue;
                left = Math.min(left, x); top = Math.min(top, y);
                right = Math.max(right, x); bottom = Math.max(bottom, y);
            }
        }
        return right < 0 ? { x: 0, y: 0, width: 0, height: 0 }
            : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    }, [pixels, trim]);

    const cols = validSize ? Math.ceil(bounds.width / width) : 0;
    const rows = validSize ? Math.ceil(bounds.height / height) : 0;
    const cells = useMemo(() => {
        if (!validSize) return [];
        if (autoSplit) return detected.map(region => ({ ...region, empty: false }));
        if (!pixels || cols * rows > 65536) return [];
        const result: (SpriteRegion & { empty: boolean })[] = [];
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
            const x = bounds.x + col * width, y = bounds.y + row * height;
            let empty = true;
            for (let py = y; py < Math.min(y + height, bounds.y + bounds.height) && empty; py++) {
                for (let px = x; px < Math.min(x + width, bounds.x + bounds.width); px++) {
                    if (pixels.data[(py * pixels.width + px) * 4 + 3] !== 0) { empty = false; break; }
                }
            }
            result.push({ x, y, width, height, empty });
        }
        return result;
    }, [pixels, validSize, rows, cols, bounds, width, height, autoSplit, detected]);
    const candidates = useMemo(() => cells.filter(cell => !skipEmpty || !cell.empty), [cells, skipEmpty]);
    const total = candidates.length;
    const usage = projectResources(current);
    const finalArea = validSize ? Math.max(current.width, width) * Math.max(current.height, height) : 0;
    const available = Number.isFinite(finalArea) && finalArea > 0
        ? Math.max(0, Math.min(MAX_FRAMES - usage.frames,
            Math.floor(MAX_PROJECT_PIXELS / finalArea) - usage.layers))
        : 0;
    const count = requestedCount ?? Math.min(total, available);
    const expectedPixels = finalArea * (usage.layers + Math.max(0, count));
    const selected = useMemo(() => candidates.slice(0, Math.max(0, count)), [candidates, count]);
    const error = !image ? '' : !validSize ? `프레임 크기는 1~${MAX_CANVAS_SIZE}px 사이의 정수로 입력해 주세요.`
        : !autoSplit && cols * rows > 65536 ? '칸이 너무 많아요. 칸 너비나 높이를 늘려 주세요.'
        : !total ? '가져올 프레임이 없어요. 이미지와 공백 제외 설정을 확인해 주세요.'
        : available < 1 ? '현재 프로젝트에 추가할 리소스가 부족해요. 프레임 수나 캔버스 크기를 줄여 주세요.'
        : !Number.isInteger(count) || count < 1 || count > Math.min(total, available) ? `프레임 수는 1~${Math.min(total, available)} 사이로 입력해 주세요.`
        : expectedPixels > MAX_PROJECT_PIXELS ? '가져올 픽셀이 너무 많아요. 프레임 수를 줄여 주세요.'
        : !Number.isInteger(fps) || fps < 1 || fps > 30 ? 'FPS는 1~30 사이의 정수로 입력해 주세요.' : '';

    useEffect(() => {
        const canvas = previewRef.current;
        if (!canvas || !image) return;
        const scale = Math.min(1, 640 / image.naturalWidth, 360 / image.naturalHeight);
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const sx = canvas.width / image.naturalWidth, sy = canvas.height / image.naturalHeight;
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const cell of selected) {
            const cw = Math.min(width, cell.width, image.naturalWidth - cell.x), ch = Math.min(height, cell.height, image.naturalHeight - cell.y);
            ctx.clearRect(cell.x * sx, cell.y * sy, cw * sx, ch * sy);
            ctx.drawImage(image, cell.x, cell.y, cw, ch, cell.x * sx, cell.y * sy, cw * sx, ch * sy);
            ctx.strokeStyle = '#818cf8';
            ctx.lineWidth = 1;
            ctx.strokeRect(cell.x * sx, cell.y * sy, cw * sx, ch * sy);
        }
    }, [image, width, height, selected]);

    const loadFile = async (file: File) => {
        const request = ++requestRef.current;
        setImage(null);
        setPixels(null);
        setDetected([]);
        setAutoSplit(false);
        setFileError('');
        setLoading(false);
        if (file.size > 10 * 1024 * 1024) { setFileError('10MB 이하 이미지만 불러올 수 있어요.'); return; }
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            setFileError('PNG·JPG·WebP 이미지를 선택해 주세요.'); return;
        }
        setLoading(true);
        const url = URL.createObjectURL(file);
        try {
            const img = new Image();
            img.src = url;
            await img.decode();
            if (request !== requestRef.current) return;
            if (img.naturalWidth * img.naturalHeight > MAX_PIXELS) throw new Error('이미지는 1,600만 픽셀 이하로 선택해 주세요.');
            setImage(img);
            setFilename(file.name);
            const source = makeCanvas(img.naturalWidth, img.naturalHeight);
            const ctx = source.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const pixelData = ctx.getImageData(0, 0, source.width, source.height);
            setPixels(pixelData);
            const regions = detectSpriteRegions(pixelData);
            setDetected(regions);
            const maxWidth = Math.max(0, ...regions.map(region => region.width));
            const maxHeight = Math.max(0, ...regions.map(region => region.height));
            if (maxWidth > 0 && maxHeight > 0 && maxWidth <= MAX_CANVAS_SIZE && maxHeight <= MAX_CANVAS_SIZE) {
                setWidth(maxWidth);
                setHeight(maxHeight);
                setAutoSplit(true);
            }
            setCount(null);
        } catch (e) {
            if (request === requestRef.current) setFileError(e instanceof Error && e.message.startsWith('이미지는') ? e.message : '이미지를 읽지 못했어요.');
        } finally {
            URL.revokeObjectURL(url);
            if (request === requestRef.current) setLoading(false);
        }
    };

    const run = async () => {
        if (!image || error || working || loading) return;
        setWorking(true);
        try {
            // Let the busy state paint before encoding frames.
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            const canvas = makeCanvas(width, height);
            const ctx = canvas.getContext('2d')!;
            const frames: CanvasState['frames'] = [];
            for (let i = 0; i < count; i++) {
                ctx.clearRect(0, 0, width, height);
                const cell = selected[i];
                const cw = Math.min(width, cell.width, image.naturalWidth - cell.x), ch = Math.min(height, cell.height, image.naturalHeight - cell.y);
                // Keep a common canvas size without scaling the sprite; align at bottom center.
                ctx.drawImage(image, cell.x, cell.y, cw, ch, Math.floor((width - cw) / 2), height - ch, cw, ch);
                frames.push({ id: `frame-${crypto.randomUUID()}`, frameOrder: i, duration: Math.round(1000 / fps),
                    layers: [{ ...createDefaultLayer(), name: filename.replace(/\.[^.]+$/, ''), pixelData: canvasToPixelData(canvas) }] });
            }
            if (await onImport({ width, height, frames, animationTags: [] })) {
                toast.success(`${count}개 프레임을 불러왔어요.`);
                onClose();
            }
        } catch (e) {
            console.error(e);
            toast.error('스프라이트 시트를 불러오지 못했어요.');
        } finally { setWorking(false); }
    };

    const inputClass = 'w-full rounded-lg border border-outline bg-transparent px-3 py-2';
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="import-sheet-title"
                className="w-[700px] max-w-[94vw] max-h-[90vh] overflow-y-auto rounded-2xl border border-outline p-5 shadow-2xl space-y-4"
                style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>
                <div className="flex justify-between items-center">
                    <h2 id="import-sheet-title" className="text-lg font-bold">스프라이트 시트 가져오기</h2>
                    <button type="button" onClick={close} disabled={working} aria-label="닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                    </button>
                </div>
                <p className="text-sm">왼쪽에서 오른쪽, 위에서 아래 순서로 나눠 현재 프로젝트의 마지막 프레임 뒤에 추가해요. 기존 프레임은 유지하고, 필요한 경우 캔버스를 확대해요.</p>
                <div className="rounded-xl border border-outline p-4 space-y-3">
                    <p className="text-sm">시트 이미지 <span className="text-xs opacity-70">PNG·JPG·WebP · 최대 10MB</span></p>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={working} className="hidden"
                        onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void loadFile(file); }} />
                    <div className="flex items-center gap-3">
                        <button type="button" disabled={working || loading} onClick={() => fileInputRef.current?.click()}
                            className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold shadow-sm hover:brightness-110 focus-visible:outline focus-visible:outline-2 disabled:opacity-40"
                            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderColor: 'var(--color-primary)' }}>
                            <span className="material-symbols-outlined" aria-hidden="true">upload_file</span>
                            {image ? '이미지 변경' : '이미지 선택'}
                        </button>
                        <span className="truncate text-sm opacity-70">{loading ? '이미지를 읽는 중…' : image ? filename : '선택한 파일이 없어요'}</span>
                    </div>
                </div>
                <fieldset disabled={working} className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <label>칸 너비 (px)<input type="number" min={1} max={MAX_CANVAS_SIZE} step={1} value={Number.isFinite(width) ? width : ''} className={inputClass} onFocus={e => e.currentTarget.select()} onChange={e => { setWidth(e.target.valueAsNumber); setCount(null); }} /></label>
                    <label>칸 높이 (px)<input type="number" min={1} max={MAX_CANVAS_SIZE} step={1} value={Number.isFinite(height) ? height : ''} className={inputClass} onFocus={e => e.currentTarget.select()} onChange={e => { setHeight(e.target.valueAsNumber); setCount(null); }} /></label>
                    <label>프레임 수<input type="number" min={1} max={Math.min(total, available)} step={1} value={Number.isFinite(count) ? requestedCount ?? (image ? count : '') : ''} className={inputClass} onFocus={e => e.currentTarget.select()} onChange={e => setCount(e.target.valueAsNumber)} /></label>
                    <label>FPS<input type="number" min={1} max={30} step={1} value={Number.isFinite(fps) ? fps : ''} className={inputClass} onFocus={e => e.currentTarget.select()} onChange={e => setFps(e.target.valueAsNumber)} /></label>
                </fieldset>
                <fieldset disabled={working} className="space-y-2 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={autoSplit} disabled={!detected.length}
                        onChange={e => { setAutoSplit(e.target.checked); setCount(null); }} />그림별 자동 분할</label>
                    <p className="text-xs opacity-70">투명한 행·열 간격으로 그림을 감지해 가장 넓은 너비와 가장 높은 높이를 자동 입력해요. 크기는 직접 수정할 수 있어요. 감지가 맞지 않으면 자동 분할을 끄고 격자로 나눠 주세요.</p>
                    {autoSplit && <button type="button" className="rounded-lg border border-outline px-3 py-1.5" onClick={() => {
                        setWidth(Math.max(...detected.map(region => region.width)));
                        setHeight(Math.max(...detected.map(region => region.height)));
                    }}>가장 큰 그림 크기로 다시 맞추기</button>}
                    <label className="flex items-center gap-2"><input type="checkbox" disabled={autoSplit} checked={trim} onChange={e => { setTrim(e.target.checked); setCount(null); }} />바깥 투명 여백 제외</label>
                    <p className="text-xs opacity-70">그림이 시작하는 위치를 격자 원점으로 사용해요. 기존 칸 정렬을 유지하려면 꺼 주세요.</p>
                    <label className="flex items-center gap-2"><input type="checkbox" disabled={autoSplit} checked={skipEmpty} onChange={e => { setSkipEmpty(e.target.checked); setCount(null); }} />완전히 투명한 칸 건너뛰기</label>
                </fieldset>
                {loading && <p role="status">이미지를 읽는 중…</p>}
                {image && <>
                    <p className="text-sm">{filename} · {image.naturalWidth}×{image.naturalHeight}px · {autoSplit ? `그림 ${detected.length}개 감지` : `${cols}열 × ${rows}행`}</p>
                    <div className="flex justify-center overflow-auto rounded-lg border border-outline p-2" style={{ background: 'repeating-conic-gradient(#8882 0% 25%, transparent 0% 50%) 0 / 16px 16px' }}>
                        <canvas ref={previewRef} aria-label="스프라이트 시트 분할 미리보기" className="max-w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                    </div>
                    <p className="text-sm" role="status">가져온 뒤 프로젝트 리소스 {Number.isFinite(expectedPixels) ? Math.ceil(expectedPixels / MAX_PROJECT_PIXELS * 100) : '—'}% · 프레임 {usage.frames + selected.length}/{MAX_FRAMES}개 · 추가 가능 {Number.isFinite(available) ? available : 0}개</p>
                    <p className="text-xs">가져올 프레임 {selected.length}개 · 빈 칸 {skipEmpty ? cells.length - total : 0}개 제외 · 최대 {MAX_FRAMES}개.
                        작은 그림은 늘리지 않고 아래 중앙에 맞춰 투명 여백으로 채워요. 입력 크기보다 큰 그림은 잘릴 수 있어요. 흰색 등 불투명한 배경은 공백으로 처리하지 않아요.</p>
                </>}
                {(fileError || error) && <p role="alert" className="text-sm" style={{ color: 'var(--color-error)' }}>{fileError || error}</p>}
                <div className="flex justify-end gap-2 border-t border-outline pt-3">
                    <button type="button" onClick={close} disabled={working} className="rounded-lg border border-outline px-4 py-2 text-sm">취소</button>
                    <button type="button" onClick={() => void run()} disabled={!image || !!error || loading || working}
                        className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                        {working ? '가져오는 중…' : '가져오기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
