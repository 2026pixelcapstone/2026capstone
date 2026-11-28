import { useId } from 'react';
import type { CanvasState, PopoverPosition } from '../../type/editor';
import { projectResources } from '../../utils/editorResources';
import { MAX_FRAME_LAYERS, MAX_PROJECT_FRAMES, MAX_PROJECT_PIXELS } from '../../constants/editor/editor';

interface ResourceGaugeProps{
    panelRef: React.RefObject<HTMLDivElement | null>;
    position: PopoverPosition;
    activeFrameId: string | null;
    state: CanvasState;
    setPosition: React.Dispatch<React.SetStateAction<PopoverPosition>>;
}

const number = (value: number) => value.toLocaleString('ko-KR');

export function EditorResourceGauge({ 
    panelRef,
    position,
    activeFrameId,
    state,
    setPosition,
}: ResourceGaugeProps) {
    const usage = projectResources(state); // 상태(픽셀수, 프레임 수, 각 프레임별 레이어의 개수) 집계
    const ratio = usage.pixels / MAX_PROJECT_PIXELS; // 최대 픽셀 대비 현재 사용중인 픽셀의 '비율'
    const percent = Math.ceil(ratio * 100); // 백분율로 변환한 뒤 소수점을 올림 처리한 정수(UI 숫자 표시에 사용)
    const gaugeColor = ratio >= 0.95 ? '#dc2626' : ratio >= 0.8 ? '#eab308' : '#16a34a'; // 사용 비율에 따라 게이지 색상 조절
    const remainingPixels = Math.max(0, MAX_PROJECT_PIXELS - usage.pixels); // 여유분이 얼마 남았는지에 대한 정보
    const canvasArea = state.width * state.height; // 캔버스 1장의 면적
    const availableLayers = canvasArea > 0 ? Math.floor(remainingPixels / canvasArea) : 0; // 남은 픽셀로 앞으로 몇 개의 레이어를 더 추가할 수 있는지 계산
    const layers = state.frames.find(f => f.id === activeFrameId)?.layers.length ?? state.frames[0]?.layers.length ?? 0; // 활성 프레임의 레이어 개수
    const exceeded = usage.pixels > MAX_PROJECT_PIXELS || usage.frames > MAX_PROJECT_FRAMES || usage.maxLayers > MAX_FRAME_LAYERS; // 프로젝트의 허용 한계치 초과 여부
    const id = useId(); // 고유 식별자

    return (
        <div className="flex shrink-0 items-center gap-2 text-xs text-on-surface-variant">
            <span className="font-bold text-[13px] tracking-wider text-on-surface-variant">프로젝트 리소스 {percent}%</span>
            {/* 프로젝트 리소스 사용량*/}
            <progress 
                aria-label="프로젝트 리소스 사용량" 
                value={Math.min(usage.pixels, MAX_PROJECT_PIXELS)} 
                max={MAX_PROJECT_PIXELS}
                className="h-2 w-20" 
                style={{ accentColor: gaugeColor }}
            />
            {/* 프로젝트 리소스 상세보기 */}
            <button
                type="button" 
                popoverTarget={id} 
                aria-label="프로젝트 리소스 상세 보기"
                title="프로젝트 리소스 상세 보기"
                className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-surface-container-high focus-visible:outline 
                    focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={event => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const width = Math.min(340, window.innerWidth - 24); // 현재 브라우저 창의 전체 가로 넓이(화면 줄어들 때 좌우 여백 12px씩(총 24px)을 남긴 크기까지)
                    // 수정: + 16(원하는 픽셀만큼)을 더해 팝오버를 오른쪽으로 이동시킴
                    const left = Math.max(12, Math.min(rect.right - width + 16, window.innerWidth - width - 12));
                    // rect.bottom + 10: 버튼과 팝오버 패널이 딱 붙지 않고 화살표 꼬리가 들어갈 공간 확보(패널의 세로 시작 위치)
                    // Math.max(16, Math.min(width - 24, rect.left + rect.width / 2 - left)): 말풍선 화살표 위치
                    setPosition({ left, top: rect.bottom + 12, arrow: Math.max(16, Math.min(width - 24, rect.left + rect.width / 2 - left)) });
                }}
            >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">info</span>
            </button>
            
            {/* 리소스 상세 보기 */}
            {exceeded && <span style={{ color: 'var(--color-error)' }}>한도 초과</span>}
            <div 
                id={id} 
                ref={panelRef} 
                popover="auto" 
                role="dialog" 
                aria-labelledby={`${id}-title`}
                className="fixed m-0 overflow-visible rounded-xl border border-outline p-4 text-sm shadow-xl"
                style={{ left: position.left, top: position.top, width: 'min(340px, calc(100vw - 24px))',
                    background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}
                >
                <span 
                    aria-hidden="true" 
                    className="absolute -top-1.5 h-3 w-3 rotate-45 border-l border-t border-outline"
                    style={{ left: position.arrow - 6, background: 'var(--color-surface-container)' }}
                />
                <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 id={`${id}-title`} className="font-bold">프로젝트 리소스 상세</h2>
                    <button 
                        type="button" 
                        popoverTarget={id} 
                        popoverTargetAction="hide" 
                        aria-label="리소스 상세 닫기"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-2xl leading-none hover:bg-surface-container-high 
                            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        ×
                    </button>
                </div>
                <div className="max-h-[calc(100dvh-140px)] space-y-3 overflow-y-auto whitespace-normal">
                    <div className="flex items-center justify-between font-bold">
                        <span>총 픽셀 사용량</span><span>{percent}%</span>
                    </div>
                    <progress 
                        aria-label="상세 픽셀 예산 사용량" 
                        value={Math.min(usage.pixels, MAX_PROJECT_PIXELS)} max={MAX_PROJECT_PIXELS}
                        className="block h-2 w-full" style={{ accentColor: gaugeColor }} 
                    />
                    <p className="text-xs">{number(usage.pixels)} / {number(MAX_PROJECT_PIXELS)} 픽셀</p>
                    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-xs">
                        <dt>남은 픽셀 사용량</dt><dd className="text-right">
                            {number(remainingPixels)} 픽셀
                            <span className="mt-1 block text-on-surface-variant">(레이어 {number(availableLayers)}개 추가 가능)</span>
                        </dd>
                        <dt>캔버스 크기</dt><dd className="text-right">{number(state.width)} × {number(state.height)} px</dd>
                        <dt>전체 레이어 합계</dt><dd className="text-right">{number(usage.layers)}개</dd>
                        <dt>프레임</dt><dd className="text-right">{usage.frames} / {MAX_PROJECT_FRAMES}개</dd>
                        <dt>현재 프레임 레이어</dt><dd className="text-right">{layers} / {MAX_FRAME_LAYERS}개</dd>
                        <dt>프레임당 최대 레이어</dt><dd className="text-right">{usage.maxLayers} / {MAX_FRAME_LAYERS}개</dd>
                    </dl>
                    <p className="border-t border-outline pt-3 text-xs leading-relaxed text-on-surface-variant">
                        {number(state.width)} × {number(state.height)}(현재 캔버스 기준) × 전체 레이어 {number(usage.layers)}개로 계산해요.
                        숨긴 레이어와 빈 레이어도 포함하며, 실제 메모리 사용량과는 달라요.
                        추가 가능 레이어 수는 남은 총 픽셀한도 기준이며, 프레임당 최대 {MAX_FRAME_LAYERS}개 제한도 적용돼요.
                    </p>
                    {exceeded && <p role="status" className="text-xs" style={{ color: 'var(--color-error)' }}>
                        한도를 초과했어요. 캔버스 크기나 프레임·레이어 수를 줄여 주세요.
                    </p>}
                </div>
            </div>
        </div>
    );
}
