import { BlendMode, LayerData, LayerViewData } from "../../type/editor";
import { BLEND_MODES } from "../../constants/editor/editor";

interface LayerDetailProps{
    activeFrameId: string | null;
    layerViewData: LayerViewData;
    onBack: () => void;
    onUpdateLayer: (activeFrameId: string | null, activeLayerId: string | null, updates: Partial<LayerData>, skipHistory: boolean) => void;
}

export function LayerDetailView({
    activeFrameId,
    layerViewData,
    onBack,
    onUpdateLayer,
}: LayerDetailProps){
    
    return(
        <div className="flex flex-col h-full text-on-surface animate-in slide-in-from-right-4 duration-200">
            {/* 상단 헤더 (뒤로가기 & 레이어 이름) */}
            <div 
                className="flex items-center gap-2 px-3 py-3 border-b"
                style={{borderColor: 'var(--color-outline)'}}
            >
                <button
                    onClick={onBack}
                    className="flex items-center justify-center p-1.5 rounded hover:bg-surface-container-highest transition-colors"
                    title="홈으로 돌아가기"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                </button>

                <div 
                    className="flex-1 font-bold text-sm truncate px-1 cursor-text hover:bg-surface-container rounded transition-colors" 
                    title="이름 변경"
                >
                    {layerViewData.name}
                </div>
            </div>

            {/* 중앙 세부 영역 설정(내부 스크롤) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {/* 블렌드 모드 */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant tracking-wider">블랜드 모드</label>
                    <select
                        value={layerViewData.blendMode || 'NORMAL'}
                        onChange={(e) => onUpdateLayer(activeFrameId, layerViewData.id, {blendMode: e.target.value as BlendMode}, false)}
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
                  onChange={(e) => {
                    const newOpacity = Number(e.target.value);
                    onUpdateLayer(activeFrameId, layerViewData.id, {opacity: newOpacity}, true);
                  }}
                  onPointerUp={(e) => {
                    const finalOpacity = Number(e.currentTarget.value);
                    onUpdateLayer(activeFrameId, layerViewData.id, {opacity: finalOpacity}, false);
                  }}
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