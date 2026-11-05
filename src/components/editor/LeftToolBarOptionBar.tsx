import React from "react";
import { EditorToolId } from "../../type/editor";
import { MAX_PIXEL_SIZE, MIN_PIXEL_SIZE } from "../../hooks/editor/useEditorShortcuts";

interface ToolOptions {
    shapeFill: boolean;
    alphaLock: boolean;
    dither: boolean;
    symmetryX: boolean;
    symmetryY: boolean;
}
interface SetToolOptions {
    setShapeFill: React.Dispatch<React.SetStateAction<boolean>>;
    setAlphaLock: React.Dispatch<React.SetStateAction<boolean>>;
    setDither: React.Dispatch<React.SetStateAction<boolean>>;
    setSymmetryX: React.Dispatch<React.SetStateAction<boolean>>;
    setSymmetryY: React.Dispatch<React.SetStateAction<boolean>>;
}

interface LeftToolOptionBarProps{
    activeTool: EditorToolId;
    pixelSize: number;
    brushSize?: number;
    pixelPerfect?: boolean;
    setPixelSize?: React.Dispatch<React.SetStateAction<number>>;
    setBrushSize?: React.Dispatch<React.SetStateAction<number>>;
    setPixelPerfect?: React.Dispatch<React.SetStateAction<boolean>>;
    toolOptions: ToolOptions;
    setToolOptions: SetToolOptions;
    onResetPan: () => void;
}

const label = "font-bold text-[13px] tracking-wider text-on-surface-variant";

function Check({ text, title, checked, onChange }: { text: string; title?: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-1.5 cursor-pointer select-none" title={title}>
            <input type="checkbox" className="accent-primary" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span className={label}>{text}</span>
        </label>
    );
}

// 도구마다 보일 옵션
const SIZE_TOOLS: EditorToolId[] = ['pencil', 'eraser', 'line', 'rect', 'ellipse'];
const PAINT_TOOLS: EditorToolId[] = ['pencil', 'line', 'rect', 'ellipse', 'fill'];          // 투명 잠금·체크무늬
const SYMMETRY_TOOLS: EditorToolId[] = ['pencil', 'eraser', 'line', 'rect', 'ellipse', 'fill'];

export function LeftToolBarOptionBar({
    activeTool,
    pixelSize,
    pixelPerfect,
    setPixelSize,
    setPixelPerfect,
    toolOptions,
    setToolOptions,
    onResetPan,
}: LeftToolOptionBarProps){
    const o = toolOptions, s = setToolOptions;
    return(
        <div className="flex items-center h-10 px-4 border-b gap-5 text-sm overflow-x-auto whitespace-nowrap"
            style={{borderColor: 'var(--color-outline)', background: 'var(--color-surface-container-low)'}}
        >
            {SIZE_TOOLS.includes(activeTool) && (
                <div className="flex items-center gap-2">
                    <label className={label} htmlFor="pixel-size-range">픽셀 크기</label>
                    <input id="pixel-size-range" className="w-24 accent-primary"
                        type="range"
                        min={MIN_PIXEL_SIZE}
                        max={MAX_PIXEL_SIZE}
                        value={pixelSize}
                        title="[ ] 키로도 바꿀 수 있어요"
                        onChange={(e) => setPixelSize && setPixelSize(parseInt(e.target.value))}
                    />
                    <span className="font-mono text-xs">{pixelSize}px</span>
                </div>
            )}
            {activeTool === 'pencil' && (
                <Check text="픽셀 퍼펙트" title="자유곡선의 L자 모서리를 자동으로 지워 선을 깔끔하게(1px·체크무늬 끔일 때)"
                    checked={!!pixelPerfect} onChange={v => setPixelPerfect && setPixelPerfect(v)} />
            )}
            {(activeTool === 'rect' || activeTool === 'ellipse') && (
                <Check text="채우기" title="도형 안쪽까지 칠하기 (Shift: 정사각형·정원)" checked={o.shapeFill} onChange={s.setShapeFill} />
            )}
            {PAINT_TOOLS.includes(activeTool) && (
                <>
                    <Check text="투명 픽셀 잠금" title="이미 칠한 칸 위에만 칠해져요(외곽선 밖으로 안 번짐)" checked={o.alphaLock} onChange={s.setAlphaLock} />
                    <Check text="체크무늬" title="한 칸씩 건너 칠하기(디더링)" checked={o.dither} onChange={s.setDither} />
                </>
            )}
            {SYMMETRY_TOOLS.includes(activeTool) && (
                <>
                    <Check text="좌우 대칭" title="세로 가운데 선을 기준으로 반대편에도 그려요" checked={o.symmetryX} onChange={s.setSymmetryX} />
                    <Check text="상하 대칭" title="가로 가운데 선을 기준으로 반대편에도 그려요" checked={o.symmetryY} onChange={s.setSymmetryY} />
                </>
            )}
            {activeTool === 'line' && (
                <span className="text-xs text-on-surface-variant">Shift: 0·45·90° 고정</span>
            )}
            {activeTool === 'pan' && (
                <div className="flex items-center gap-3">
                    <span className="text-xs text-on-surface-variant">끌어서 화면 이동 · 다른 도구에서도 스페이스를 누른 채 끌면 이동</span>
                    <button type="button" onClick={onResetPan}
                        className="px-2 py-0.5 rounded border text-xs font-bold hover:bg-surface-container-high"
                        style={{ borderColor: 'var(--color-outline)' }}>가운데로</button>
                </div>
            )}
            {activeTool === 'eyedrop' && (
                <span className="text-xs text-on-surface-variant">다른 도구에서도 Alt를 누른 채 클릭하면 색을 집어요</span>
            )}
        </div>
    )
}
