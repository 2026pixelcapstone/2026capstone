import { EditorToolId } from "../../type/editor";

interface LeftToolOptionBarProps{
    activeTool: EditorToolId;
    pixelSize: number;
    brushSize?: number;
    pixelPerfect?: boolean;
    setPixelSize?: React.Dispatch<React.SetStateAction<number>>;
    setBrushSize?: React.Dispatch<React.SetStateAction<number>>;
    setPixelPerfect?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function LeftToolBarOptionBar({
    activeTool,
    pixelSize,
    pixelPerfect,
    setPixelSize,
    setPixelPerfect,
}: LeftToolOptionBarProps){
    return(
        <div className="flex items-center h-10 px-4 border-b gap-6 text-sm"
            style={{borderColor: 'var(--color-outline)', background: 'var(--color-surface-container-low)'}}
        >
            {/* 선택된 도구가 '연필(pencil)'일 때 */}
            {activeTool === 'pencil' &&(
                <div className="flex items-center gap-2">
                    <label className="font-bold text-[13px] tracking-wider text-on-surface-variant">픽셀 크기</label>
                    <input className="w-24 accent-primary"
                        type="range"
                        min="1"
                        max="20"
                        value={pixelSize}
                        onChange={(e) => setPixelSize && setPixelSize(parseInt(e.target.value))}
                    />
                    {/* 추후 변수로 교체 */}
                    <span className="font-mono text-xs">{pixelSize}px</span>
                    <label className="font-bold text-[13px] tracking-wider text-on-surface-variant">픽셀 퍼펙트</label>
                    <input 
                        type="checkbox" 
                        className="accent-primary" 
                        checked={pixelPerfect}
                        onChange={(e) => setPixelPerfect && setPixelPerfect(e.target.checked)}
                    />
                </div>
            )}
            {/* 선택된 도구가 '지우개(eraser)'일 때 */}
            {activeTool === 'eraser' &&(
                <div className="flex items-center gap-2">
                    <label className="font-bold text-[13px] tracking-wider text-on-surface-variant">픽셀 크기</label>
                    <input className="w-24 accent-primary"
                        type="range"
                        min="1"
                        max="20"
                        value={pixelSize}
                        onChange={(e) => setPixelSize && setPixelSize(parseInt(e.target.value))}
                    />
                    <span className="font-mono text-xs">{pixelSize}px</span>
                </div>
            )}
            {/* 선택된 도구가 '선(line)'일 때 */}
            {activeTool === 'line' &&(
                <div className="flex items-center gap-2">
                    <label className="font-bold text-[13px] tracking-wider text-on-surface-variant">픽셀 크기</label>
                    <input className="w-24 accent-primary"
                        type="range"
                        min="1"
                        max="20"
                        value={pixelSize}
                        onChange={(e) => setPixelSize && setPixelSize(parseInt(e.target.value))}
                    />
                    <span className="font-mono text-xs">{pixelSize}px</span>
                </div>
            )}
        </div>
    )
}