import React from "react";
import { EditorToolId } from "../../type/editor";
import { MAX_PIXEL_SIZE, MIN_PIXEL_SIZE } from "../../hooks/editor/useEditorShortcuts";
import { DRAW_TOOLS, SELECT_TOOLS, SHAPE_TOOLS, VIEW_TOOLS } from "../../constants/editor/editor";

interface ToolOptions {
    shapeFill: boolean;
    alphaLock: boolean;
    dither: boolean;
    symmetryX: boolean;
    symmetryY: boolean;
    // PR-G
    contiguous: boolean;
    tolerance: number;
    shadeDarken: boolean;
    wrap: boolean;
}
interface SetToolOptions {
    setShapeFill: React.Dispatch<React.SetStateAction<boolean>>;
    setAlphaLock: React.Dispatch<React.SetStateAction<boolean>>;
    setDither: React.Dispatch<React.SetStateAction<boolean>>;
    setSymmetryX: React.Dispatch<React.SetStateAction<boolean>>;
    setSymmetryY: React.Dispatch<React.SetStateAction<boolean>>;
    setContiguous: React.Dispatch<React.SetStateAction<boolean>>;
    setTolerance: React.Dispatch<React.SetStateAction<number>>;
    setShadeDarken: React.Dispatch<React.SetStateAction<boolean>>;
    setWrap: React.Dispatch<React.SetStateAction<boolean>>;
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
    // 선택·그리드 스냅(PR-D)
    gridSnap: boolean;
    setGridSnap: React.Dispatch<React.SetStateAction<boolean>>;
    gridSize: number;
    setGridSize: React.Dispatch<React.SetStateAction<number>>;
    hasSelection: boolean;
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
const SIZE_TOOLS: EditorToolId[] = ['pencil', 'eraser', 'line', 'rect', 'ellipse', 'shade'];
const WRAP_TOOLS: EditorToolId[] = ['pencil', 'eraser', 'line', 'rect', 'ellipse'];   // 타일 모드(PR-G)
const PAINT_TOOLS: EditorToolId[] = ['pencil', 'line', 'rect', 'ellipse', 'fill'];          // 투명 잠금·체크무늬
const SYMMETRY_TOOLS: EditorToolId[] = ['pencil', 'eraser', 'line', 'rect', 'ellipse', 'fill', 'shade'];

export function LeftToolBarOptionBar({
    activeTool,
    pixelSize,
    pixelPerfect,
    setPixelSize,
    setPixelPerfect,
    toolOptions,
    setToolOptions,
    onResetPan,
    gridSnap,
    setGridSnap,
    gridSize,
    setGridSize,
    hasSelection,
}: LeftToolOptionBarProps){
    const o = toolOptions, s = setToolOptions;
    const toolName = [...DRAW_TOOLS, ...SELECT_TOOLS, ...SHAPE_TOOLS, ...VIEW_TOOLS].find(t => t.id === activeTool)?.label;
    return(
        <div className="flex items-center h-10 px-4 border-b gap-5 text-sm overflow-x-auto whitespace-nowrap"
            style={{borderColor: 'var(--color-outline)', background: 'var(--color-surface-container-low)'}}
        >
            {/* 지금 도구 이름(PR-F) — 왼쪽 도구 모음은 아이콘뿐이라 */}
            {toolName && (
                <span className="flex items-center gap-1.5 font-bold text-xs flex-shrink-0" style={{ color: 'var(--color-primary)' }}>
                    {toolName}
                </span>
            )}
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
            {WRAP_TOOLS.includes(activeTool) && (
                <Check text="타일 모드" title="가장자리를 넘어가면 반대편에 이어 그려요(배경 타일 만들 때 — 보기 › 타일 미리보기로 확인)" checked={o.wrap} onChange={s.setWrap} />
            )}
            {(activeTool === 'fill' || activeTool === 'wand') && (
                <>
                    <Check text="이어진 칸만" title="끄면 떨어져 있어도 같은 색 칸을 전부(채우기·마술봉)" checked={o.contiguous} onChange={s.setContiguous} />
                    <div className="flex items-center gap-2">
                        <label className={label} htmlFor="tolerance-range">허용 오차</label>
                        <input id="tolerance-range" className="w-20 accent-primary" type="range" min={0} max={128} value={o.tolerance}
                            title="0이면 완전히 같은 색만, 높일수록 비슷한 색까지"
                            onChange={e => s.setTolerance(parseInt(e.target.value))} />
                        <span className="font-mono text-xs w-6">{o.tolerance}</span>
                    </div>
                </>
            )}
            {activeTool === 'wand' && (
                <span className="text-xs text-on-surface-variant">누른 칸과 같은 색 영역 선택 · 편집 메뉴에서 뒤집기·회전 · Ctrl+Shift+I 반전</span>
            )}
            {activeTool === 'shade' && (
                <>
                    <Check text="어둡게" title="끄면 한 칸 밝게, 켜면 한 칸 어둡게" checked={o.shadeDarken} onChange={s.setShadeDarken} />
                    <span className="text-xs text-on-surface-variant">칠한 칸을 팔레트의 비슷한 색 중 한 단계 {o.shadeDarken ? '어두운' : '밝은'} 색으로 · 한 번 긋는 동안 같은 칸은 한 번만</span>
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
            {['marquee', 'lasso', 'move', 'rect', 'ellipse'].includes(activeTool) && (
                <div className="flex items-center gap-2">
                    <Check text="그리드 스냅" title="선택·도형·이동이 격자에 맞춰 붙어요(보기 메뉴에서도 켜고 끌 수 있어요)" checked={gridSnap} onChange={setGridSnap} />
                    {gridSnap && [8, 16, 32].map(g => (
                        <button key={g} type="button" onClick={() => setGridSize(g)} aria-pressed={gridSize === g}
                            className="px-1.5 py-0.5 rounded border text-xs font-bold"
                            style={{ borderColor: 'var(--color-outline)', background: gridSize === g ? 'var(--color-primary)' : 'transparent', color: gridSize === g ? 'var(--color-on-primary)' : undefined }}>{g}</button>
                    ))}
                </div>
            )}
            {(activeTool === 'marquee' || activeTool === 'lasso') && (
                <span className="text-xs text-on-surface-variant">끌어서 선택 · 클릭하면 해제(Esc) · Ctrl+A 전체 · Ctrl+C·X·V · Delete 지우기</span>
            )}
            {activeTool === 'move' && (
                <span className="text-xs text-on-surface-variant">{hasSelection ? '선택한 부분을 끌어서 옮겨요' : '선택이 없으면 레이어 전체를 옮겨요'}</span>
            )}
            {activeTool === 'eyedrop' && (
                <span className="text-xs text-on-surface-variant">다른 도구에서도 Alt를 누른 채 클릭하면 색을 집어요</span>
            )}
        </div>
    )
}
