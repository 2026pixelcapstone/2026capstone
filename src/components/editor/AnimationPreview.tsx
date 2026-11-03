import { FrameData } from "../../type/editor";
import { useRef } from "react";

interface AnimPreviewProps{
    previewFrameIdx: number;
    isPlaying: boolean;
    fps: number;
    setFps: (fps: number) => void;
    frames: FrameData[];
    setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    updateAllAnimDurations: (duration: number) => void
}

export function AnimationPreview({
    previewFrameIdx,
    isPlaying,
    fps,
    setFps,
    frames,
    setIsPlaying,
    updateAllAnimDurations,
}: AnimPreviewProps){
    const pendingFps = useRef<number | null>(null);

    const commitDuration = () => {
        if (pendingFps.current === null) return;
        updateAllAnimDurations(1000 / pendingFps.current);
        pendingFps.current = null;
    };
    
    return(
        <div className="p-4 border-b shrink-0" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="w-full px-3 mb-2 text-center">
                <span className="text-[15px] font-bold tracking-tight" style={{color: 'var(--color-on-surface-variant)'}}> 
                    애니메이션
                </span>
            </div>
            
            {/* 애니메이션 프리뷰 */}
            <div className="w-48 mx-auto bg-[#1e2329] rounded-lg shadow-xl border border-gray-700 flex flex-col overflow-hidden">
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
        </div>
    )
}
