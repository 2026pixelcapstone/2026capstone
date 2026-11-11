import { getLabel } from "../../utils/editorUtils";
import { DRAW_TOOLS, SELECT_TOOLS, SHAPE_TOOLS, VIEW_TOOLS } from "../../constants/editor/editor";
import { Dispatch, SetStateAction, useState } from "react";
import { EditorToolId } from "../../type/editor";
import { ColorPickerModal } from "./ColorPickerModal";

interface EditorToolProps{
    activeTool: EditorToolId;
    activeColorTarget: 'fg' | 'bg';
    fgColor: string;
    bgColor: string;
    rgb:{ r: number; g: number; b: number; }
    setActiveColorTarget: Dispatch<SetStateAction<'fg' | 'bg'>>;
    setActiveTool: Dispatch<SetStateAction<EditorToolId>>;
    setFgColor: Dispatch<SetStateAction<string>>;
    setBgColor: Dispatch<SetStateAction<string>>;
    handleRgbChange: (channel: "r" | "g" | "b", value: number) => void;
    handleSwapColors: () => void;
}

export function EditorToolBar({
    activeTool,
    activeColorTarget,
    fgColor,
    bgColor,
    rgb,
    setActiveColorTarget,
    setActiveTool,
    setFgColor,
    setBgColor,
    handleRgbChange,
    handleSwapColors,
}: EditorToolProps){

    const [isHexModal, setIsHexModal] = useState(false);
    const [modalPos, setModalPos] = useState({ top: 0, left: 0 });

    // 툴 버튼 공통 스타일
    const toolBtn = (id: string) => ({
        background: activeTool === id ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
        color: activeTool === id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
    })

    const handleOpenModal = (e: React.MouseEvent<HTMLButtonElement>) => {
        // 버튼의 화면상 크기와 위치 정보 가져오기
        const rect = e.currentTarget.getBoundingClientRect();
        setModalPos({
            top: rect.top - 100, // 버튼의 상단과 맞춤
            left: rect.right + 10, // 버튼의 오른쪽 끝 + 여백 10px 위치
        });
        setIsHexModal(true)
    };

    const handleColorPickerChange = (newColor: string) => {
        // 1. 타겟에 맞는 캔버스/배경 색상 업데이트
        if (activeColorTarget === 'fg') {
            setFgColor(newColor);
        } else {
            setBgColor(newColor);
        }
        
    };
    {/* ── 좌측 툴바 ── */}
    return (
        <aside className="flex flex-col py-3 gap-1 flex-shrink-0 border-r"
            style={{ width: 115, background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>

            {/* 제목 */}
            <div className="w-full px-3 mb-2 text-center">
                <span 
                    className="text-[15px] font-bold tracking-tight" 
                    style = {{color: 'var(--color-on-surface-variant)' }}
                >
                  도구 모음  
                </span>
            </div>
            {/* 그리기 도구 */}
            <div className="grid grid-cols-2 gap-0 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {DRAW_TOOLS.map(t => (
                <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-12 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                </button>
            ))}
            </div>

            {/* 선택 도구 */}
            <div className="grid grid-cols-2 gap-0 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {SELECT_TOOLS.map(t => (
                <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-12 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"

                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                </button>
            ))}
            </div>

            {/* 도형 도구 */}
            <div className="grid grid-cols-2 gap-0 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {SHAPE_TOOLS.map(t => (
                <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-12 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                </button>
            ))}
            </div>

            {/* 뷰 도구 (하단 고정) */}
            <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {VIEW_TOOLS.map(t => (
                <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                </button>
            ))}
            </div>

            {/* 컬러 도구 */}
            <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
                {/* FG / BG 색상 */}
                <div className="flex flex-col items-center gap-4 mb-4 px-1">
                    <div className="relative">
                        {/* 새로 추가된 연결고리(스왑) 버튼 (우측 상단 배치) */}
                        <button 
                            type="button"
                            className="absolute top-13 right-7 w-6 h-6 flex items-center justify-center rounded-md bg-surface border shadow-sm cursor-pointer hover:bg-surface-container-high transition-colors z-20"
                            style={{ borderColor: 'var(--color-outline)' }}
                            title="전경·배경색 바꾸기 (X)"
                            onClick={handleSwapColors}
                        >
                            {/* Material Symbols 아이콘 사용*/}
                            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                                swap_horiz
                            </span>
                        </button>
                        <button type = "button" 
                            className="w-12 h-12 rounded-lg border-2 cursor-pointer shadow-sm"
                            style={{ background: fgColor, borderColor: 'var(--color-outline)' }} 
                            title="전경색"
                            onClick={(e) => {
                                setActiveColorTarget('fg');
                                handleOpenModal(e);
                            }} 
                        />
                        {/* 서브 색상 (Background) */}
                        <button 
                            type="button"
                            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg border-2 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                            style={{ background: bgColor, borderColor: 'var(--color-outline)' }} 
                            title="배경색 (누르면 바꾸기)" 
                            onClick={(e) =>{
                                setActiveColorTarget('bg');
                                handleOpenModal(e);
                            }}
                        />
                    </div>
                </div>
            </div>

            <ColorPickerModal
                isOpen = {isHexModal}
                position = {modalPos}
                color = {activeColorTarget === 'fg' ? fgColor : bgColor}
                rgb={rgb}
                handleRgbChange = {handleRgbChange}
                onClose = {() => setIsHexModal(false)}
                onChange = {handleColorPickerChange}
            />
        </aside>
    )
}