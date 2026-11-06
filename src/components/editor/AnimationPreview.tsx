import { AnimationTag, FrameData } from "../../type/editor";
import React, { useEffect, useRef, useState } from "react";
import { AnimationDetailView } from "./AnimationDetailView";
import { MIN_DURATION_30FPS } from "../../constants/editor/editor";

interface AnimPreviewProps{
    activeAnimId: string | null;
    isPlaying: boolean;
    fps: number;
    animationTags: AnimationTag[] | null;
    setFps: (fps: number) => void;
    setActiveAnimId: React.Dispatch<React.SetStateAction<string | null>>;
    frames: FrameData[];
    setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    updateAllAnimDurations: (duration: number) => void
}

export function AnimationPreview({
    activeAnimId,
    isPlaying,
    fps,
    animationTags,
    setFps,
    setActiveAnimId,
    frames,
    setIsPlaying,
    updateAllAnimDurations,
}: AnimPreviewProps){
    const pendingFps = useRef<number | null>(null);
    const [animDetailView, setAnimDetailView] = useState(false);
    const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
       
    // 애니메이션 실행 effect
    useEffect(() => {
        if (!isPlaying) {
            setPreviewFrameIdx(0);
            return;
        }
        // 1. 현재 선택된 태그에 해당하는 프레임들의 '원래 인덱스'만 모아 배열로 만듭니다.
        // (선택된 태그가 없다면 전체 프레임 인덱스가 담깁니다)
        const validIndices = frames
            .map((frame, idx) => ({ tagId: frame.tagId, originalIndex: idx }))
            .filter(f => activeAnimId == null || f.tagId === activeAnimId)
            .map(f => f.originalIndex);

        // 조건에 맞는 프레임이 아예 없거나, 1장뿐이라면 굳이 타이머를 돌리지 않고 종료합니다.
        if (validIndices.length === 0) return;
        if (validIndices.length === 1 && activeAnimId == null) return;

        // 현재 프레임의 duration 가져오기
        const currentFrame = frames[previewFrameIdx];
        const duration = currentFrame?.duration || 100;

        // 재생 안전가드 적용
        const safePlayDuration = (Number.isFinite(duration) && duration > 0)
        ? Math.max(MIN_DURATION_30FPS, duration) 
        : 1000; // 계산 실패 시 안전하게 1초(1000ms) 대기
        
        // 각 프레임에 저장된 표시 시간만큼 기다린 뒤 다음 프레임으로 이동한다.
        const timeout = setTimeout(() => {
            setPreviewFrameIdx((prevIdx) => {
                const currentPos = validIndices.indexOf(prevIdx);
                
                // 현재 프레임이 태그 구간에 없거나, 구간의 마지막 프레임이라면 -> 구간의 첫 프레임으로 루프!
                if (currentPos === -1 || currentPos === validIndices.length - 1) {
                    return validIndices[0];
                }
                
                // 그 외에는 바로 다음 태그 프레임으로 이동
                return validIndices[currentPos + 1];
            });
        }, safePlayDuration);
        return () => clearTimeout(timeout);
    }, [isPlaying, frames, activeAnimId, previewFrameIdx]);

    const commitDuration = () => {
        if (pendingFps.current === null) return;
        updateAllAnimDurations(Math.round(1000 / pendingFps.current));
        pendingFps.current = null;
    };
    
    return(
        <div className="p-4 border-b shrink-0" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-start w-full px-1 mb-3 gap-2">
                <span className="text-[15px] font-bold tracking-tight" style={{color: 'var(--color-on-surface-variant)'}}> 
                    애니메이션
                </span>
                
                {/* 💡 '태그:' 글자와 드롭다운을 묶어주는 래퍼(div) 추가 */}
                <div className="flex items-center gap-2">
                    <span className="w-px h-3.5 bg-white/20" style={{ background: 'var(--color-surface-container-highest)' }} />
                    <span className="text-[14px] font-medium" style={{color: 'var(--color-on-surface-variant)'}}>
                        태그:
                    </span>
                    <select
                        value={activeAnimId ?? ""}
                        onChange={(e) => {
                            const val = e.target.value;
                            // '전체 재생'은 태그 필터를 해제합니다.
                            setActiveAnimId(val === "" ? null : val);}}

                        className="text-[12px] font-medium px-1.5 py-0.5 rounded cursor-pointer outline-none transition-colors"
                        style={{ 
                            background: 'var(--color-surface-container-high)', 
                            border: '1px solid var(--color-outline-variant)',
                            color: 'var(--color-on-surface)'
                        }}
                        title="재생할 애니메이션 태그 선택"
                    >
                        <option value="">전체 재생</option>
                        {/* 태그가 비어있을 때만 나타나는 안내 문구 (disabled 속성으로 클릭 방지) */}
                        {(!animationTags || animationTags.length === 0) && (
                            <option value="none" disabled>
                                태그 없음
                            </option>
                        )}

                        {animationTags?.map(tag => (
                            <option key={tag.id} value={tag.id}>
                                {tag.name}
                            </option>
                        ))}
                    </select>
                </div>
                
            </div>
            {/* 애니메이션 프리뷰 */}
            <div className="w-full mx-auto bg-[#1e2329] rounded-lg shadow-xl border border-gray-700 flex flex-col overflow-hidden">
                <div className="group/preview aspect-square checkerboard rounded overflow-hidden flex items-center justify-center relative">
                    {(() => {
                    const safePreviewFrameIdx = Math.max(0, Math.min(previewFrameIdx, frames.length - 1));
                    // 레이어 탐색, 보이고 pixelData가 존재하는 레이어 중 첫 번째 레이어를 타깃으로 잡음
                    const layerPreviews = (frames[safePreviewFrameIdx]?.layers ?? [])
                        .filter((layer) => layer.isVisible) // 보이는 레이어만 필터링
                        .map((layer) => {
                        let src: string | null = null;
                        if(layer.pixelData){
                            try{
                            const frameImages = layer.pixelData;
                            if(frameImages) src = frameImages;
                            } catch (e){
                            console.error("레이어 썸네일 파싱 에러", e);
                            }
                        }
                        return {id: layer.id, src, opacity: layer.opacity}
                        });

                        // 수집된 레이어들을 CSS 절대 좌표(absolute)를 이용해 아래서부터 위로 차곡차곡 겹쳐서 렌더링
                        return(
                        <div className='absolute inset-0 w-full h-full pointer-events-none'>
                            {layerPreviews.map((lp) => {
                            if(!lp.src) return null; // 해당 프레임에 그림이 없는 레이어는 패스
                            return (
                            <img
                                key={lp.id}
                                src={lp.src}
                                className="absolute inset-0 w-full h-full object-contain"
                                style={{
                                // 💡 픽셀 아트 깨짐(뭉개짐) 방지 및 레이어별 실제 투명도 실시간 반영!
                                imageRendering: 'pixelated', 
                                opacity: lp.opacity / 100, 
                                }}
                                alt="layer-thumb"
                            />
                            );
                            })}
                        </div>
                        )
                    })()}
                
                   {/* 컨트롤 버튼 그룹 (부모 div에 우측 상단 배치 및 호버 로직 통합) */}
                    <div className="absolute right-2 top-2 z-10 flex gap-1.5 transition-opacity opacity-100 pointer-events-auto [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none group-hover/preview:opacity-100 group-hover/preview:pointer-events-auto has-[:focus-visible]:opacity-100 has-[:focus-visible]:pointer-events-auto">
                        {/* 전체 화면 버튼 (왼쪽) */}
                        <button
                            type="button"
                            onClick={() => setAnimDetailView(true)}
                            aria-label="애니메이션 화면 전체 보기"
                            title="전체 보기"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">
                                fullscreen
                            </span>
                        </button>

                        {/* 재생 / 정지 버튼 (오른쪽) */}
                        <button 
                            type="button"
                            aria-label={isPlaying ? '애니메이션 정지' : '애니메이션 재생'}
                            title={isPlaying ? '정지' : '재생'}
                            onClick={() => setIsPlaying(prev => !prev)}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white transition-colors" 
                        >
                            <span className="material-symbols-outlined text-lg">
                                {isPlaying ? 'pause' : 'play_arrow'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* 재생 컨트롤 */}
                <div 
                    className="flex items-center gap-2 p-3 border-t" 
                    style={{ borderColor: 'var(--color-outline)' }}
                >
                    <label className="flex flex-1 min-w-0 items-center gap-2 text-[10px] text-on-surface-variant">
                        <span className="shrink-0 tabular-nums whitespace-nowrap">{fps} FPS</span>
                        <input
                            type="range"
                            min={1}
                            max={30}
                            step={1}
                            value={fps}
                            onChange={e => {
                                const nextFps = Number(e.target.value);
                                pendingFps.current = nextFps;
                                setFps(nextFps);
                            }}
                            onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)}
                            onPointerUp={commitDuration}
                            onPointerCancel={commitDuration}
                            onKeyUp={commitDuration}
                            onBlur={commitDuration}
                            aria-label="애니메이션 재생 속도"
                            aria-valuetext={`초당 ${fps}프레임`}
                            className="min-w-0 flex-1 cursor-pointer accent-primary"
                        />
                    </label>
                </div>
            </div>
            <AnimationDetailView
                isOpen = {animDetailView}
                onClose = {setAnimDetailView}
                frames = {frames} 
                fps = {fps}
                animationTags = {animationTags ?? null}
            />
        </div>
    )
}
