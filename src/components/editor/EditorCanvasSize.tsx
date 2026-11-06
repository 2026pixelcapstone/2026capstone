import { CANVAS_PRESETS, MAX_CANVAS_SIZE } from "../../constants/editor/editor";
import React, { useEffect, useRef } from "react";

interface EditorCanvasSizeProps{
    position: {top: number, left: number}
    isOpen: boolean;
    customW: number;
    customH: number;
    isScaleImage: boolean;
    onClose: () => void;
    setCustomW: React.Dispatch<React.SetStateAction<number>>;
    setCustomH: React.Dispatch<React.SetStateAction<number>>;
    setIsScaleImage: React.Dispatch<React.SetStateAction<boolean>>;
    applyCanvasSize: (w: number, h: number) => void;
    /** 기존 그림을 둘 기준점(PR-F) — 없으면 기준점 칸을 숨김 */
    anchor?: { x: number; y: number };
    setAnchor?: (a: { x: number; y: number }) => void;
}

const ANCHORS = [0, 0.5, 1].flatMap(y => [0, 0.5, 1].map(x => ({ x, y })));
const ANCHOR_ICON: Record<string, string> = {
    '0,0': 'north_west', '0.5,0': 'north', '1,0': 'north_east',
    '0,0.5': 'west', '0.5,0.5': 'filter_center_focus', '1,0.5': 'east',
    '0,1': 'south_west', '0.5,1': 'south', '1,1': 'south_east',
};
export function EditorCanvasSize({
    position,
    isOpen,
    customW,
    customH,
    isScaleImage,
    onClose,
    setCustomW,
    setCustomH,
    setIsScaleImage,
    applyCanvasSize,
    anchor,
    setAnchor,
}:EditorCanvasSizeProps){

    const modalRef = useRef<HTMLDivElement>(null);   // 모달 창 자체를 가리킬 ref 생성
    
    // 외부 클릭 감지 이벤트 로직
    useEffect(() => {
        if (!isOpen) return; // 열려있을 때만 이벤트 등록

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
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    
    return(
        <div 
            ref={modalRef} 
            // 💡 fixed와 z-50을 추가하고, 플로팅 모달에 맞게 UI(rounded, shadow, bg)를 다듬었습니다.
            className="fixed p-4 rounded-xl shadow-xl z-50 w-64" 
            style={{ 
                top: `${position.top}px`, 
                left: `${position.left}px`,
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-outline)'
            }}
            // 💡 모달 내부 클릭 시 뒷배경(캔버스) 이벤트 발동 방지
            onClick={(e) => e.stopPropagation()}
        >
            
            {/* 상단 헤더 영역 */}
            <div className="relative flex items-center justify-center mb-3">
                {/* 중앙 정렬된 제목 */}
                <div 
                    className="text-base font-bold text-center tracking-tight break-keep" 
                    style={{ color: 'var(--color-on-surface-variant)' }}
                >
                    캔버스 크기
                </div>
                
                {/* 우측 상단 X(닫기) 버튼 */}
                <button 
                    onClick={onClose}
                    className="absolute right-0 flex items-center justify-center p-1 rounded hover:bg-surface-container-highest transition-colors"
                    style={{ color: 'var(--color-on-surface-variant)' }}
                    title="닫기"
                >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>
            
            <div className="px-1 space-y-2">
            {/* 1. 프리셋 버튼 grid */}
            <div className="grid grid-cols-3 gap-1">
                {CANVAS_PRESETS.map(p => {
                const [w, h] = p.split('×').map(Number)
                const active = customW === w && customH === h;
                return (
                    <button 
                    key={p} 
                    onClick={() =>{
                        setCustomW(w);
                        setCustomH(h);
                        
                    }}
                    className="py-1 text-xs rounded-lg font-bold transition-all border"
                    style={{
                        background: active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-surface-container-low)',
                        borderColor: active ? 'var(--color-primary)' : 'var(--color-outline)',
                        color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    }}>{p}</button>
                )
                })}
            </div>

            {/* 2. 커스텀 크기 설정 및 Apply 버튼 */}
            <div className="flex items-center gap-1.5 pt-1">
                <input type="number" value={customW} min={1} max={512}
                onChange={e => setCustomW(Number(e.target.value))}
                className="w-17 px-2 py-1 rounded text-xs outline-none text-center font-bold"
                style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
                <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>×</span>
                <input type="number" value={customH} min={1} max={512}
                onChange={e => setCustomH(Number(e.target.value))}
                className="w-17 px-2 py-1 rounded text-xs outline-none text-center font-bold"
                style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
                <button onClick={() => {
                    // 최대 크기 초과 방지 유효성 검사
                    if (customW > MAX_CANVAS_SIZE || customH > MAX_CANVAS_SIZE) {
                        alert(`캔버스 크기는 최대 ${MAX_CANVAS_SIZE}x${MAX_CANVAS_SIZE}까지 설정할 수 있습니다.`);
                        return;
                    }
                    if (customW < 1 || customH < 1) {
                        alert('캔버스 크기는 최소 1 이상이어야 합니다.');
                        return;
                    }
                    
                    if (!Number.isInteger(customW) || !Number.isInteger(customH)) {
                        alert('캔버스 크기는 정수여야 합니다.');
                        return;
                    } 
                    applyCanvasSize(customW, customH)
                    onClose();
                }}
                className="flex-1 py-1 rounded text-xs font-bold transition-all hover:opacity-90"
                style={{ background: 'var(--color-primary)', color: '#fff' }}>적용</button>
            </div>
            
            {/* 기준점(PR-F): 크기를 바꿀 때 기존 그림을 어느 쪽에 붙일지 */}
            {anchor && setAnchor && !isScaleImage && (
                <div className="flex items-center gap-3 pt-1">
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>기준점</span>
                    <div className="grid grid-cols-3 gap-0.5" role="radiogroup" aria-label="크기 바꿀 때 그림 기준점">
                        {ANCHORS.map(a => {
                            const on = anchor.x === a.x && anchor.y === a.y;
                            return (
                                <button key={`${a.x},${a.y}`} type="button" role="radio" aria-checked={on}
                                    aria-label={`기준점 ${a.x === 0 ? '왼쪽' : a.x === 1 ? '오른쪽' : '가운데'} ${a.y === 0 ? '위' : a.y === 1 ? '아래' : '가운데'}`}
                                    onClick={() => setAnchor(a)}
                                    className="w-6 h-6 flex items-center justify-center rounded"
                                    style={{
                                        background: on ? 'var(--color-primary)' : 'var(--color-surface-container-low)',
                                        color: on ? 'var(--color-background)' : 'var(--color-on-surface-variant)',
                                        border: '1px solid var(--color-outline)',
                                    }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{ANCHOR_ICON[`${a.x},${a.y}`]}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/*3. 이미지 비율 보정 체크 박스*/}
            <div className="flex items-center gap-2 pt-1 pb-0.5 select-none cursor-pointer">
                <input
                type="checkbox"
                id="scale-image-toggle"
                checked={isScaleImage}
                onChange={(e) => setIsScaleImage(e.target.checked)}
                className="rounded cursor-pointer accent-primary bg-surface-container-low" 
                style={{ 
                    width: '13px', 
                    height: '13px',
                    border: '1px solid var(--color-outline)'
                }}
                />
                <label
                htmlFor="scale-image-toggle"
                className="text-[13px] font-semibold cursor-pointer" // 전체 UI 비율에 맞춰 폰트 크기를 약간 슬림하게 조절
                style={{ color: 'var(--color-on-surface-variant)' }}
                >
                크기 변경 시 기존 이미지 비율 보정
                </label>
            </div>
        </div>
    </div>
    )
}