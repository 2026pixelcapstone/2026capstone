import { useEffect, useRef, useState } from "react";
import { AnimationTag, FrameViewData } from "../../type/editor";
import { MAX_DURATION, MIN_DURATION_30FPS } from "../../constants/editor/editor";

interface FrameDetailProps{
    position: { top: number, left: number }
    detailFrameId: string | null;
    frameViewData: FrameViewData;
    animationTags: AnimationTag[]; // 전체 태그 목록
    updateAnimDurations: (frameId: string | null, duration: number | null, skipHistory: boolean, forceCommit: boolean) => void;
    updateFrameTag: (frameId: string | null, tagId: string | null) => void; // 프레임에 태그 장착/해제
    createAnimationTag: (name: string, color: string) => void; // 새 태그 생성
    deleteAnimationTag: (animTagId: string | null) => void;
    onClose: () => void;
}

export function FrameDetailView({
    position,
    detailFrameId,
    frameViewData,
    animationTags,
    updateAnimDurations,
    updateFrameTag,
    createAnimationTag,
    deleteAnimationTag,
    onClose
}: FrameDetailProps){

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    // 새 태그 생성 UI 상태
    const [isCreatingTag, setIsCreatingTag] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#2f81f7"); // 기본 색상

    const modalRef = useRef<HTMLDivElement>(null);

    // 외부 클릭 감지 이벤트 로직
    useEffect(() => {
        if (!detailFrameId) return; // 열려있을 때만 이벤트 등록

        const handleClickOutside = (e: MouseEvent) => {
            // 클릭한 대상(e.target)이 모달(modalRef.current)의 내부 요소가 아니라면 닫기
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
            }
        };

        // 마우스를 누르는 순간(mousedown) 감지
        document.addEventListener('mousedown', handleClickOutside);
        
        // 클린업 함수: 컴포넌트가 언마운트되거나 닫힐 때 이벤트 제거
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [detailFrameId, onClose]);
    if(!detailFrameId) return null;

    const handleCreateTag = () => {
        if (!newTagName.trim()) return;
        createAnimationTag(newTagName.trim(), newTagColor);
        setNewTagName("");
        setIsCreatingTag(false);
    };
    
    return(
        <div 
            ref = {modalRef}
            // fixed 속성으로 브라우저 뷰포트 기준 위치를 고정합니다.
            className="fixed w-64 bg-surface border border-outline rounded-xl p-4 shadow-xl z-10 flex flex-col gap-4 text-on-surface"
            style={{
                top: `${position.top}px`, 
                left: `${position.left}px`
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* 1. 상단 헤더 영역 */}
            <div className="flex items-center justify-between pb-3 border-b" style={{borderColor: 'var(--color-outline)'}}>
                <span className="text-base font-bold">프레임 설정</span>
                <button 
                    onClick={onClose}
                    className="p-1 rounded hover:bg-surface-container-highest transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">close</span>
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
                            if(['e','E','+','-', '.'].includes(e.key)){
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
                            let value = Math.round(Number(e.target.value));
                            value = Math.max(MIN_DURATION_30FPS, Math.min(MAX_DURATION, value)); // 최소값과 최대값 제한
                            e.target.value = String(value); // 입력창에 교정된 값 반영
                            updateAnimDurations(frameViewData.id, value, false, true);
                        }}
                    />
                </div>
            </div>
            {/* 2. 태그 설정 영역 추가 */}
            <div className="flex flex-col gap-3 pt-3 border-t" style={{borderColor: 'var(--color-outline)'}}>
                <span className="text-[13px] font-bold">태그 (Tag)</span>
                
                {/* 장착 가능한 태그 목록 (배지 형태) */}
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => updateFrameTag(frameViewData.id, null)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                            !frameViewData.tagId 
                            ? 'bg-surface-container-highest border-outline text-on-surface' 
                            : 'border-outline text-on-surface-variant hover:bg-surface-container'
                        }`}
                    >
                        None
                    </button>
                    {animationTags.map(tag => {
                        const isSelected = frameViewData.tagId === tag.id;
                        return (
                            <button
                                key={tag.id}
                                onClick={() => updateFrameTag(frameViewData.id, tag.id)}
                                className="px-2 py-1 text-[11px] rounded border transition-all font-medium"
                                style={{
                                    backgroundColor: isSelected ? tag.color : 'transparent',
                                    borderColor: tag.color,
                                    color: isSelected ? '#fff' : tag.color,
                                    opacity: isSelected ? 1 : 0.7
                                }}
                            >
                                {tag.name}
                            </button>
                        )
                    })}
                    {/*  태그 삭제 버튼 ('None'이 아닐 때만 표시) */}
                    {frameViewData.tagId && (
                        <button
                            type="button"
                            onClick={() => deleteAnimationTag(frameViewData.tagId)}
                            className="flex items-center justify-center w-7 h-7 rounded transition-colors"
                            style={{ color: 'var(--color-error)' }} // 빨간색 계열 테마 변수 (또는 '#ef4444' 사용)
                            title="현재 태그 완전히 삭제"
                        >
                            <span className="material-symbols-outlined text-[18px] hover:scale-110 transition-transform">
                                delete
                            </span>
                        </button>
                    )}
                </div>

                {/* 태그 생성 폼 / 토글 버튼 */}
                {!isCreatingTag ? (
                    <button
                        onClick={() => setIsCreatingTag(true)}
                        className="text-[11px] flex items-center gap-1 w-fit mt-1 text-on-surface-variant hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-[14px]">add</span> 
                        새 태그 만들기
                    </button>
                ) : (
                    <div className="flex flex-col gap-2 mt-1 p-2.5 rounded bg-surface-container-low border border-outline">
                        <input
                            type="text"
                            placeholder="태그 이름 (예: Walk)"
                            value={newTagName}
                            onChange={e => setNewTagName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                            className="w-full bg-surface px-2 py-1 text-[12px] rounded border border-outline focus:outline-none focus:border-primary"
                        />
                        <div className="flex items-center gap-2">
                            {/* 색상 선택기 */}
                            <input
                                type="color"
                                value={newTagColor}
                                onChange={e => setNewTagColor(e.target.value)}
                                className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                            />
                            <button
                                onClick={handleCreateTag}
                                className="flex-1 bg-primary hover:opacity-90 text-on-primary text-[11px] py-1.5 rounded transition-opacity font-bold"
                            >
                                추가
                            </button>
                            <button
                                onClick={() => setIsCreatingTag(false)}
                                className="flex-1 bg-surface-container-highest hover:opacity-90 text-on-surface text-[11px] py-1.5 rounded transition-opacity"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
