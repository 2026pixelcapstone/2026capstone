import { useEffect, useId, useRef, useState } from 'react';
import type { CanvasState } from '../../type/editor';
import { MAX_PROJECT_PIXELS, MAX_PROJECT_FRAMES, MAX_FRAME_LAYERS, projectResources } from '../../utils/editorResources';

const number = (value: number) => value.toLocaleString('ko-KR');

export function EditorResourceGauge({ state, activeFrameId }: { state: CanvasState; activeFrameId: string | null }) {
    const usage = projectResources(state);
    const ratio = usage.pixels / MAX_PROJECT_PIXELS;
    const percent = Math.ceil(ratio * 100);
    const gaugeColor = ratio >= 0.95 ? '#dc2626' : ratio >= 0.8 ? '#eab308' : '#16a34a';
    const remainingPixels = Math.max(0, MAX_PROJECT_PIXELS - usage.pixels);
    const canvasArea = state.width * state.height;
    const availableLayers = canvasArea > 0 ? Math.floor(remainingPixels / canvasArea) : 0;
    const layers = state.frames.find(f => f.id === activeFrameId)?.layers.length ?? state.frames[0]?.layers.length ?? 0;
    const exceeded = usage.pixels > MAX_PROJECT_PIXELS || usage.frames > MAX_PROJECT_FRAMES || usage.maxLayers > MAX_FRAME_LAYERS;
    const id = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: 0, top: 0, arrow: 24 });

    useEffect(() => {
        const close = (event: Event) => {
            if (event.type === 'scroll' && event.target instanceof Node && panelRef.current?.contains(event.target)) return;
            panelRef.current?.hidePopover();
        };
        window.addEventListener('resize', close);
        // The toolbar can scroll on narrow screens. Close rather than leave a detached bubble.
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
        };
    }, []);

    return <div className="flex shrink-0 items-center gap-2 text-xs text-on-surface-variant">
        <span className="font-bold text-[13px] tracking-wider text-on-surface-variant">프로젝트 리소스 {percent}%</span>
        <progress aria-label="프로젝트 리소스 사용량" value={Math.min(usage.pixels, MAX_PROJECT_PIXELS)} max={MAX_PROJECT_PIXELS}
            className="h-2 w-20" style={{ accentColor: gaugeColor }} />
        <button type="button" popoverTarget={id} aria-label="프로젝트 리소스 상세 보기"
            title="프로젝트 리소스 상세 보기"
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={event => {
                const rect = event.currentTarget.getBoundingClientRect();
                const width = Math.min(340, window.innerWidth - 24);
                const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
                setPosition({ left, top: rect.bottom + 10, arrow: Math.max(16, Math.min(width - 24, rect.left + rect.width / 2 - left)) });
            }}><span className="material-symbols-outlined text-[18px]" aria-hidden="true">info</span></button>
        {exceeded && <span style={{ color: 'var(--color-error)' }}>한도 초과</span>}
        <div id={id} ref={panelRef} popover="auto" role="dialog" aria-labelledby={`${id}-title`}
            className="fixed m-0 overflow-visible rounded-xl border border-outline p-4 text-sm shadow-xl"
            style={{ left: position.left, top: position.top, width: 'min(340px, calc(100vw - 24px))',
                background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>
            <span aria-hidden="true" className="absolute -top-1.5 h-3 w-3 rotate-45 border-l border-t border-outline"
                style={{ left: position.arrow - 6, background: 'var(--color-surface-container)' }} />
            <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id={`${id}-title`} className="font-bold">프로젝트 리소스 상세</h2>
                <button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="리소스 상세 닫기"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-2xl leading-none hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">×</button>
            </div>
            <div className="max-h-[calc(100dvh-140px)] space-y-3 overflow-y-auto whitespace-normal">
                <div className="flex items-center justify-between font-bold">
                    <span>픽셀 예산 사용량</span><span>{percent}%</span>
                </div>
                <progress aria-label="상세 픽셀 예산 사용량" value={Math.min(usage.pixels, MAX_PROJECT_PIXELS)} max={MAX_PROJECT_PIXELS}
                    className="block h-2 w-full" style={{ accentColor: gaugeColor }} />
                <p className="text-xs">{number(usage.pixels)} / {number(MAX_PROJECT_PIXELS)} 픽셀</p>
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-xs">
                    <dt>남은 픽셀 예산</dt><dd className="text-right">
                        {number(remainingPixels)} 픽셀
                        <span className="mt-1 block text-on-surface-variant">(레이어 {number(availableLayers)}개 추가 가능)</span>
                    </dd>
                    <dt>캔버스 크기</dt><dd className="text-right">{number(state.width)} × {number(state.height)} px</dd>
                    <dt>전체 레이어 합계</dt><dd className="text-right">{number(usage.layers)}개</dd>
                    <dt>프레임</dt><dd className="text-right">{usage.frames} / {MAX_PROJECT_FRAMES}개</dd>
                    <dt>현재 프레임 레이어</dt><dd className="text-right">{layers} / {MAX_FRAME_LAYERS}개</dd>
                    <dt>프레임별 최다 레이어</dt><dd className="text-right">{usage.maxLayers} / {MAX_FRAME_LAYERS}개</dd>
                </dl>
                <p className="border-t border-outline pt-3 text-xs leading-relaxed text-on-surface-variant">
                    {number(state.width)} × {number(state.height)} × 전체 레이어 {number(usage.layers)}개로 계산해요.
                    숨긴 레이어와 빈 레이어도 포함하며, 실제 메모리 사용량과는 달라요.
                    추가 가능 수는 현재 캔버스 크기의 픽셀 예산 기준이며, 프레임당 레이어 {MAX_FRAME_LAYERS}개 제한도 적용돼요.
                </p>
                {exceeded && <p role="status" className="text-xs" style={{ color: 'var(--color-error)' }}>
                    한도를 초과했어요. 캔버스 크기나 프레임·레이어 수를 줄여 주세요.
                </p>}
            </div>
        </div>
    </div>;
}
