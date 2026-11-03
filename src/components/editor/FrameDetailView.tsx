import { useState } from "react";
import { FrameViewData } from "../../type/editor";
import { MAX_DURATION, MIN_DURATION_30FPS } from "../../constants/editor/editor";

interface FrameDetailProps{
    detailFrameId: string | null;
    frameViewData: FrameViewData;
    updateAnimDurations: (frameId: string | null, duration: number | null, skipHistory: boolean, forceCommit: boolean) => void;
}

export function FrameDetailView({
    detailFrameId,
    frameViewData,
    updateAnimDurations,
}: FrameDetailProps){

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    if(!detailFrameId) return;

    return(
        <div 
            // fixed 속성으로 브라우저 뷰포트 기준 위치를 고정합니다.
            className="flex w-64 bg-surface border border-outline rounded-xl p-4 shadow-xl z-10 flex flex-col gap-4 text-on-surface"
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
                        defaultValue={frameViewData.duration || 100}
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
                            updateAnimDurations(frameViewData.id, safeValue, true, false);
                        }}
                        onBlur={(e) => {
                            // 입력창에서 빠져나올 때 값을 검사하고 교정함
                            let value = Number(e.target.value);
                            value = Math.max(MIN_DURATION_30FPS, Math.min(MAX_DURATION, value)); // 최소값과 최대값 제한
                            
                            e.target.value = String(value); // 입력창에 교정된 값 반영
                            updateAnimDurations(frameViewData.id, value, false, true);
                        }}
                    />
                </div>
            </div>
        </div>
    )
}