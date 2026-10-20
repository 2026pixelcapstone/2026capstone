import { getLabel } from "../../utils/editorUtils";
import { DRAW_TOOLS, SELECT_TOOLS, SHAPE_TOOLS, VIEW_TOOLS } from "../../constants/editor/editor";
import { Dispatch, SetStateAction } from "react";

interface EditorToolProps{
    activeTool: string;
    fgColor: string;
    hexInput: string;
    setActiveTool: Dispatch<SetStateAction<string>>;
    setIsHexModal: Dispatch<SetStateAction<boolean>>;
    setHexInput: Dispatch<SetStateAction<string>>;
    applyHex: () => void;
}

export function EditorToolBar({
    activeTool,
    fgColor,
    hexInput,
    setActiveTool,
    setIsHexModal,
    setHexInput,
    applyHex,
}: EditorToolProps){

    // 툴 버튼 공통 스타일
    const toolBtn = (id: string) => ({
        background: activeTool === id ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
        color: activeTool === id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
    })

    {/* ── 좌측 툴바 ── */}
    return (
        <aside className="flex flex-col items-center py-3 gap-1 flex-shrink-0 border-r"
            style={{ width: 100, background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>

            {/* 그리기 도구 */}
            <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {DRAW_TOOLS.map(t => (
                <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                </button>
            ))}
            </div>

            {/* 선택 도구 */}
            <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {SELECT_TOOLS.map(t => (
                <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                </button>
            ))}
            </div>

            {/* 도형 도구 */}
            <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {SHAPE_TOOLS.map(t => (
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
                        <div className="w-12 h-12 rounded-lg border-2 cursor-pointer shadow-sm"
                        style={{ background: fgColor, borderColor: 'var(--color-outline)' }} 
                        title="Foreground"
                        onClick={() => setIsHexModal(true)} 
                        />
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg border-2 shadow-sm"
                        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }} title="Background" />
                    </div>
                    <div className="w-full">
                        <div className="text-xs mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>HEX</div>
                        <input type="text" value={hexInput}
                        onChange={e => setHexInput(e.target.value)}
                        onBlur={applyHex}
                        onKeyDown={e => e.key === 'Enter' && applyHex()}
                        className="w-full text-sm font-bold rounded-lg px-2 py-1.5 outline-none"
                        style={{ background: 'var(--color-surface-container-low)', border: 'none', color: 'var(--color-on-surface)' }} />
                    </div>
                </div>

            </div>


            {/* 뷰 도구 (하단 고정) */}
            <div className="flex flex-col items-center gap-1 w-full px-2 mt-auto">
            {VIEW_TOOLS.map(t => (
                <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                </button>
            ))}
            </div>
        </aside>
    )
}