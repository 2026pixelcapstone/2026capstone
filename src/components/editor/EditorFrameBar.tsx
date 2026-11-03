import { createPortal } from "react-dom";
import { FrameData } from "../../type/editor";
import { Dispatch, DragEvent, SetStateAction, useState } from "react";
import { MAX_DURATION, MIN_DURATION_30FPS } from "../../constants/editor/editor";


interface FrameProps{
    showFramePanel: boolean;
    activeFrameId: string | null;
    frames: FrameData[]; 
    setShowFramePanel: Dispatch<SetStateAction<boolean>>;
    handleSelectFrame: (frameId: string) => void;
    handleFrameDragStart: (e: DragEvent<HTMLDivElement>, frameIdx: number) => void;
    handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
    handleFrameDrop: (e: DragEvent<HTMLDivElement>, frameIdx: number) => void;
    addFrame: () => void;
    deleteFrame: (frameId: string | null) => void;
    updateAnimDurations: (frameId: string | null, duration: number | null, skipHistory: boolean) => void;
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
    updateAnimDurations,
}: FrameProps){

    const [popupConfig, setPopupConfig] = useState<{ id: string, top: number, left: number} | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    return(
        <div 
            className="flex flex-col flex-shrink-0 border-r min-h-0"
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

                            <button onClick={(e) => {
                                e.stopPropagation(); // 캔버스 클릭 처리 방지
                                // 설정창 팝업 토글 로직
                                if(popupConfig?.id === frame.id){
                                    setPopupConfig(null);
                                }
                                else{
                                    const frameRect = e.currentTarget.parentElement?.getBoundingClientRect();
                                    
                                    if(frameRect){
                                        setPopupConfig({
                                            id: frame.id, 
                                            top: frameRect.top, 
                                            left: frameRect.right + 13
                                        })
                                    }
                                }
                            }}
                            className={`absolute bottom-1 right-1 z-10 w-5 h-5 bg-gray-600/80 hover:bg-gray-500 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity${
                                isActive 
                                ? 'bg-gray-500/80 hover:bg-gray-400 text-white' // 활성화 상태: 밝은 배경과 흰색 아이콘
                                : 'bg-gray-800/80 hover:bg-gray-600 text-gray-400' // 비활성화 상태: 어두운 배경과 회색 아이콘
                            }`}
                            title='Frame Settings'>
                                <span className = 'material-symbols-outlined text-[14px]'>settings</span>
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
                            {/* 프레임 설정 팝업창 (Portal 사용) */}
                            {popupConfig?.id === frame.id && createPortal(
                                <div 
                                    // fixed 속성으로 브라우저 뷰포트 기준 위치를 고정합니다.
                                    className="fixed w-64 bg-surface border border-outline rounded-xl p-4 shadow-xl z-9999 flex flex-col gap-4 text-on-surface"
                                    style={{ 
                                        top: `${popupConfig.top}px`, 
                                        left: `${popupConfig.left}px` 
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* 1. 상단 헤더 영역 */}
                                    <div className="flex items-center justify-between pb-3 border-b" style={{borderColor: 'var(--color-outline)'}}>
                                        <span className="text-base font-bold">프레임 설정</span>
                                        <button className="p-1 rounded hover:bg-surface-container-highest transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">tune</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {/*  라벨과 에러 메시지를 가로로 나란히 배치 */}
                                        <div className="flex items-center justify-between">
                                            {errorMessage && (
                                                <span className="text-[12px] text-red-400 animate-in fade-in duration-200">
                                                    {errorMessage}
                                                </span>
                                            )}
                                        </div>
                                        {/* 지속 시간 설정 영역 */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px]">지속 시간 (ms)</span>
                                            <input
                                                type="number"
                                                className="w-15 bg-surface px-1 rounded text-right border border-outline"
                                                max={MAX_DURATION}
                                                min={MIN_DURATION_30FPS}
                                                defaultValue={frame.duration || 100}
                                                onKeyDown={(e) => {
                                                    // 숫자 입력창에서 허용되는 기호 입력을 막음
                                                    if(['e','E','+','-'].includes(e.key)){
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onChange={(e) => {
                                                    const rawValue = Number(e.target.value);
                                                    // 입력값을 안전하게 제한하여 최소값과 최대값 사이로 조정
                                                    if(rawValue < MIN_DURATION_30FPS){
                                                        setErrorMessage(`최소 ${MIN_DURATION_30FPS}ms 이에요.`);
                                                    }
                                                    else if(rawValue > MAX_DURATION){
                                                        setErrorMessage(`최대 ${MAX_DURATION}ms 이에요.`);
                                                    }
                                                    else {
                                                        setErrorMessage(null);
                                                    }
                                                    const safeValue = Math.max(MIN_DURATION_30FPS, Math.min(MAX_DURATION, rawValue));
                                                    updateAnimDurations(frame.id, safeValue, true);
                                                }}
                                                onBlur={(e) => {
                                                    // 입력창에서 빠져나올 때 값을 검사하고 교정함
                                                    let value = Number(e.target.value);
                                                    value = Math.max(MIN_DURATION_30FPS, Math.min(MAX_DURATION, value)); // 최소값과 최대값 제한
                                                    
                                                    e.target.value = String(value); // 입력창에 교정된 값 반영
                                                    updateAnimDurations(frame.id, value, false);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            , document.body)}
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