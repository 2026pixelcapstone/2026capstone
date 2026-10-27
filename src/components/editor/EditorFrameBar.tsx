import { FrameData } from "@/type/editor";
import { Dispatch, DragEvent, SetStateAction } from "react";

interface FrameProps{
    showFramePanel: boolean;
    activeFrameId: string | null;
    frames: FrameData[]; 
    setShowFramePanel: Dispatch<SetStateAction<boolean>>;
    handleSelectFrame: (frameId: string) => void;
    handleFrameDragStart: (e: DragEvent<HTMLDivElement>, frameIdx: number) => void;
    handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
    handleFrameDrop: (e: DragEvent<HTMLDivElement>, frameIdx: number) => void;
    addFrame: () => void
    deleteFrame: (frameId: string) => void;
}

export function EditorFrameBar({
    showFramePanel,
    activeFrameId,
    frames,
    setShowFramePanel,
    handleSelectFrame,
    handleFrameDragStart,
    handleDragOver,
    handleFrameDrop,
    addFrame,
    deleteFrame,
}: FrameProps){

    return(
        <div 
            className="flex flex-col flex-shrink-0 border-l min-h-0"
            style={{ 
                width: showFramePanel ? 160 : 36, 
                background: 'var(--color-surface)', 
                borderColor: 'var(--color-outline)', 
                transition: 'width 0.2s' 
            }}>
            {/* 토글 버튼 */}
            <button onClick={() => setShowFramePanel(v => !v)}
                className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-colors hover:bg-surface-container"
                style={{ color: showFramePanel ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}
                title="Animation">
                <span className="material-symbols-outlined text-xl">animation</span>
            </button>

            {showFramePanel && (
                <div className="flex flex-col flex-1 overflow-hidden">
                <div className='px-3 py-2 text-xs font-bold uppercase tracking-widest border-b flex items-center justify-between'
                    style={{ color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline)' }} > 
                    <span>Anim</span>
                    <span className='text-[10px]'>{frames.length} frame{frames.length > 1 ? 's' : ''}</span>  
                </div>

                {/* 프레임 목록 */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {frames.map((frame, index) => {
                        const isActive = frame.id === activeFrameId;
                        return(
                        <div
                            key = {frame.id}
                            draggable
                            onClick={() => handleSelectFrame(frame.id)} // 프레임 선택 기능
                            onDragStart={(e) => handleFrameDragStart(e, index)} // 드래그 시작
                            onDragOver={(e) => handleDragOver(e)} // 드래그 오버 허용
                            onDrop={(e) => handleFrameDrop(e, index)} // 드롭
                            className='relative group rounded-lg border-2 p-1 cursor-pointer'
                            style={{
                            borderColor: isActive ? 'var(--color-primary)' : 'var(--color-outline)',
                            background: isActive ? 'var(--color-surface-container-low)' : 'transparent'
                            }}>

                            <button onClick={(e) => {
                            e.stopPropagation(); // 클릭 이벤트가 부모로 퍼지는 것 방지
                            deleteFrame(frame.id);
                            }}
                            className='absolute top-1 right-1 z-10 w-5 h-5 bg-red-500/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'
                            title='Delete Frame'>
                            <span className='material-symbols-outlined text-[14px]'>close</span>
                            </button>

                            {/* 미리보기 영역 (Canvas thumbnail  등을 넣을 수 있음)*/}
                            <div className="aspect-square checkerboard rounded overflow-hidden flex items-center justify-center relative">
                            {(() => {
                                // 레이어 탐색, 보이고 pixelData가 존재하는 레이어 중 첫 번째 레이어를 타깃으로 잡음
                                const layerPreviews = (frame.layers ?? [])
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
                                // 만약 모든 레이어에 아무런 그림이 없다면 Empty 표시
                                const hasAnyImage = layerPreviews.some((lp) => lp.src);
                                if(!hasAnyImage){
                                    return <span className="text-[10px] text-gray-500 z-10">Empty</span>; 
                                }

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
                            </div>
                        </div>
                        )
                    })}
                
                    {/* 프레임 추가 버튼 */}
                    <button
                    onClick={() => addFrame()}
                    className='w-full aspect-square rounded-lg border-2 border-dashed flex items-center justify-center transition-colors hover:bg-surface-container hover:border-on-surface-variant'
                    style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-lg">add</span>
                    </button>
                </div>
                </div>
            )}
        </div>
    )
}