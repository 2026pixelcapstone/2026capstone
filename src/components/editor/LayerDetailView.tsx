import { BlendMode, LayerData, LayerViewData } from "../../type/editor";
import { BLEND_MODES } from "../../constants/editor/editor";
import React, { useRef, useState } from "react";

interface LayerDetailProps{
    activeFrameId: string | null;
    layerViewData: LayerViewData;
    setDetailLayer: React.Dispatch<React.SetStateAction<string | null>>;
    updateLayer: (activeFrameId: string | null, activeLayerId: string | null, updates: Partial<LayerData>, skipHistory: boolean) => void;
}

export function LayerDetailView({
    activeFrameId,
    layerViewData,
    setDetailLayer,
    updateLayer,
}: LayerDetailProps){

    const startOpacity = useRef<number | null>(null);
    // 이름 바꾸기(PR-F) — 이전엔 툴팁만 있고 못 바꿨음
    const [nameDraft, setNameDraft] = useState<string | null>(null);
    const commitName = () => {
        const name = nameDraft?.trim();
        if (name && name !== layerViewData.name) updateLayer(activeFrameId, layerViewData.id, { name: name.slice(0, 50) }, false);
        setNameDraft(null);
    };
    const commitOpacity = (finalOpacity: number) => {
        const start = startOpacity.current;
       startOpacity.current = null;
        if (start === null || start === finalOpacity) return;

        updateLayer(activeFrameId, layerViewData.id, {opacity: start}, true);
        updateLayer(activeFrameId, layerViewData.id, {opacity: finalOpacity}, false);
    };

    return(
        <div className="flex flex-col h-full text-on-surface animate-in slide-in-from-right-4 duration-200">
            {/* 상단 헤더 (뒤로가기 & 레이어 이름) */}
            <div 
                className="flex items-center gap-2 px-3 py-3 border-b"
                style={{borderColor: 'var(--color-outline)'}}
            >
                <button
                    onClick={() => setDetailLayer(null)}
                    className="flex items-center justify-center p-1.5 rounded hover:bg-surface-container-highest transition-colors"
                    title="홈으로 돌아가기"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                </button>

                {nameDraft !== null ? (
                    <input
                        autoFocus
                        value={nameDraft}
                        maxLength={50}
                        aria-label="레이어 이름"
                        onChange={e => setNameDraft(e.target.value)}
                        onBlur={commitName}
                        onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === 'Enter') commitName();
                            if (e.key === 'Escape') setNameDraft(null);
                        }}
                        className="flex-1 min-w-0 font-bold text-sm rounded px-1 outline-none"
                        style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-primary)', color: 'var(--color-on-surface)' }}
                    />
                ) : (
                <button
                    type="button"
                    onClick={() => setNameDraft(layerViewData.name)}
                    className="flex-1 text-left font-bold text-sm truncate px-1 cursor-text hover:bg-surface-container rounded transition-colors" 
                    title="클릭해서 이름 바꾸기"
                >
                    {layerViewData.name}
                </button>
                )}
            </div>

            {/* 중앙 세부 영역 설정(내부 스크롤) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {/* 블렌드 모드 */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant tracking-wider">블렌드 모드</label>
                    <select
                        value={layerViewData.blendMode || 'NORMAL'}
                        onChange={(e) => updateLayer(activeFrameId, layerViewData.id, {blendMode: e.target.value as BlendMode}, false)}
                        className="w-full bg-surface-container border rounded p-2 text-sm outline-none focus:border-primary transition-colors cursor-pointer"
                        style={{borderColor: 'var(--color-outline)'}}
                    >
                        {BLEND_MODES.map((mode) => (
                            <option key={mode.value} value={mode.value}>{mode.label}</option>
                        ))}
                    {/* 필요에 따라 추가 */}
                    </select>
                </div>
                <label className="text-xs font-bold text-on-surface-variant tracking-wider">투명도</label>
                <span className="text-xs font-mono font-bold bg-surface-container px-2 py-0.5 rounded">
                    {layerViewData.opacity}%
                </span>
                <input type="range" min={0} max={100} value={layerViewData.opacity ?? 100}
                  onPointerDown={() => { startOpacity.current ??= layerViewData.opacity ?? 100; }}
                  onChange={(e) => {
                    const newOpacity = Number(e.target.value);
                    startOpacity.current ??= layerViewData.opacity ?? 100;
                    updateLayer(activeFrameId, layerViewData.id, {opacity: newOpacity}, true);
                  }}
                  onPointerUp={(e) => {
                    commitOpacity(Number(e.currentTarget.value));
                  }}
                  onKeyUp={(e) => commitOpacity(Number(e.currentTarget.value))}
                  onBlur={(e) => commitOpacity(Number(e.currentTarget.value))}
                  
                  className="w-full h-1.5 cursor-pointer accent-primary"
                />
                
                {/* 폴더 지정 등 추가 설정이 들어갈 자리 */}
            </div>
            <div className="p-4 border-b bg-surface-container-lowest" style={{borderColor: 'var(--color-outline)'}}>
                <div className="flex items-center justify-between mb-3">
                    
                </div>
            </div>
        </div>
    )
}