import { EditorToolId, FrameData, Point } from "../../type/editor";
import { KonvaEventObject } from "konva/lib/Node";
import { LayerImageRenderer } from "./LayerImageRender";
import { Layer, Rect, Stage } from "react-konva";
import { OnionSkinCanvas } from "./OnionSkinCanvas";
import Konva from "konva";
import { resizedLayerCanvases } from "../../utils/resizedLayerCanvas";
import React, { useEffect } from "react";
import { blendCss } from "../../utils/blendMode";
import { ZOOM_LEVELS } from "../../constants/editor/editor";
import { DragShape } from "../../hooks/editor/useCanvasDrawing";
import { lineRatio, RATIO_GUIDE_DIRS } from "../../utils/pixelBrush";
import { ReadabilityPreview } from "./ReadabilityPreview";

interface EditorCanvasProps{
    activeTool: EditorToolId;
    activeFrameId: string | null;
    zoom: number;
    showGridLines: boolean;
    cursorPos: Point;
    pixelSize: number;
    stageRef: React.RefObject<Konva.Stage | null>;
    currentFrame: FrameData;
    setZoomIdx: React.Dispatch<React.SetStateAction<number>>;
    ensureLayerCanvas: (cachekey: string) => HTMLCanvasElement | null;
    canvasProps: CanvasProps;
    mouseEvnetProps: MouseEventProps;
    panProps: PanProps;
    overlayProps: OverlayProps;
    previewProps: PreviewProps;
    onionProps: OnionProps;
    referenceProps: ReferenceProps;
    selectionProps: SelectionOverlayProps;
}
// 손 도구: 래퍼를 CSS로 옮김
interface PanProps{
    offset: { x: number; y: number };
    panning: boolean;
    startPan: (e: React.MouseEvent) => void;
}
// 화면 보조(그림에는 안 들어감): 픽셀 카운터·비율 가이드·대칭 축
interface OverlayProps{
    dragShape: DragShape | null;
    pixelCounter: boolean;
    ratioGuide: boolean;
    symmetryX: boolean;
    symmetryY: boolean;
}
// 어니언 스킨: 앞(빨강)·뒤(초록) 프레임을 물들인 그림
interface OnionProps{
    prev: HTMLCanvasElement | null;
    next: HTMLCanvasElement | null;
}
// 참조 이미지(그림에 안 들어감): 캔버스에 맞춰 반투명하게 위·아래로
interface ReferenceProps{
    url: string | null;
    visible: boolean;
    opacity: number;
    front: boolean;
    setOpacity: (v: number) => void;
    setFront: (v: boolean) => void;
    close: () => void;
}
// 선택(PR-D): 점선 테두리 경로·올가미 미리보기·선택 크기, 그리드 스냅 격자
interface SelectionOverlayProps{
    outline: string;
    lasso: Point[] | null;
    size: { w: number; h: number } | null;
    gridSnap: boolean;
    gridSize: number;
}
interface PreviewProps{
    open: boolean;
    onClose: () => void;
    peekLayerCanvas: (cacheKey: string) => HTMLCanvasElement | null;
    mode: 'normal' | 'tile';
}
interface CanvasProps{
    frames: FrameData[];
    width: number;
    height: number;
}
interface MouseEventProps{
    handleMouseDown: () => void;
    handleMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
    handleMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
    handleMouseLeave: (e: KonvaEventObject<MouseEvent>) => void;
}
export function EditorCanvas({
    activeTool,
    activeFrameId,
    zoom,
    showGridLines,
    cursorPos,
    pixelSize,
    stageRef,
    currentFrame,
    setZoomIdx,
    ensureLayerCanvas,
    canvasProps,
    mouseEvnetProps,
    panProps,
    overlayProps,
    previewProps,
    onionProps,
    referenceProps,
    selectionProps,
}: EditorCanvasProps){
    const showRef = !!referenceProps.url && referenceProps.visible;

    // 레이어 혼합 모드를 화면에 반영(PR-F): Konva 레이어마다 따로 있는 <canvas>에 CSS mix-blend-mode,
    // 겹침 영역(konvajs-content)은 isolation으로 묶어 페이지 배경과는 섞이지 않게(합성 결과 = 내보내기·병합과 같음)
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.content.style.isolation = 'isolate';
        for (const l of currentFrame?.layers ?? []) {
            const node = stage.findOne<Konva.Layer>(`#${l.id}`);
            const el = node?.getCanvas()._canvas;
            const css = blendCss(l.blendMode);
            if (el && el.style.mixBlendMode !== css) el.style.mixBlendMode = css;
        }
    });

    const offset = Math.floor((pixelSize - 1) / 2);
    const isPan = activeTool === 'pan';
    const { dragShape, pixelCounter, ratioGuide, symmetryX, symmetryY } = overlayProps;
    const W = canvasProps.width, H = canvasProps.height;

    // 끄는 중인 직선·도형 정보(픽셀 카운터·비율 가이드)
    const dragLabel = (() => {
        // 선택 중·선택 있음: 선택 크기(픽셀 카운터)
        if (!dragShape && pixelCounter && selectionProps.size && (activeTool === 'marquee' || activeTool === 'lasso' || activeTool === 'move')) {
            return { text: `선택 ${selectionProps.size.w}×${selectionProps.size.h}`, clean: null as boolean | null };
        }
        if (!dragShape) return null;
        const { start, end, tool } = dragShape;
        const w = Math.abs(end.x - start.x) + 1, h = Math.abs(end.y - start.y) + 1;
        const parts: string[] = [];
        if (pixelCounter) parts.push(tool === 'line' ? `${Math.max(w, h)}칸` : `${w}×${h}`);
        let clean: boolean | null = null;
        if (ratioGuide && tool === 'line') {
            const r = lineRatio(start, end);
            parts.push(r.clean ? `${r.label} 깔끔한 선` : `${r.label} 계단 불규칙`);
            clean = r.clean;
        }
        return parts.length ? { text: parts.join(' · '), clean } : null;
    })();
    const rayLen = Math.max(W, H) * 2;

    {/* 바깥 배경: 캔버스보다 약간 진한 중간 회색 (체커보드) */}
    return(
        <main className="flex-1 flex items-center justify-center overflow-hidden relative"
            onMouseDown={(e) => { if (isPan) panProps.startPan(e); }}
            style={{
            cursor: isPan ? (panProps.panning ? 'grabbing' : 'grab')
                : activeTool === 'move' ? 'move'
                : (activeTool === 'marquee' || activeTool === 'lasso') ? 'crosshair' : undefined,
            backgroundColor: '#767676',
            backgroundImage: [
                'linear-gradient(45deg,#848484 25%,transparent 25%)',
                'linear-gradient(-45deg,#848484 25%,transparent 25%)',
                'linear-gradient(45deg,transparent 75%,#848484 75%)',
                'linear-gradient(-45deg,transparent 75%,#848484 75%)',
            ].join(','),
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
        }}> 
            {/* 캔버스 래퍼 — backgroundColor로 연회색 보장 */}
            <div className="relative shadow-2xl"
                style={{ 
                width: canvasProps.width, 
                height: canvasProps.height,
                transform: `translate(${panProps.offset.x}px, ${panProps.offset.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                backgroundColor: '#e8e8e8',
                imageRendering: 'pixelated'
            }}
            >
                {/* 픽셀 그리드 오버레이 */}
                {showGridLines && zoom >= 8 && (
                    <div className="absolute inset-0 pointer-events-none z-20"
                    style={{
                        backgroundImage: `linear-gradient(rgba(80,80,80,0.25) ${1/zoom}px, transparent 0), linear-gradient(90deg, rgba(80,80,80,0.25) ${1/zoom}px, transparent 0)`,
                        backgroundSize: `1px 1px`,
                    }} />
                )}
                {showRef && (
                    <img src={referenceProps.url!} alt="" aria-hidden draggable={false}
                        className="absolute inset-0 w-full h-full pointer-events-none select-none"
                        style={{ objectFit: 'contain', opacity: referenceProps.opacity / 100, zIndex: referenceProps.front ? 15 : 0 }} />
                )}
                {/* 어니언 스킨: Stage 밖 DOM 캔버스(Stage를 그림으로 뽑을 때 섞이지 않게), Stage 아래에 깔림 */}
                <OnionSkinCanvas prev={onionProps.prev} next={onionProps.next} width={canvasProps.width} height={canvasProps.height} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                <Stage
                    ref={stageRef}
                    width={canvasProps.width}
                    height={canvasProps.height}
                    pixelRatio={1}
                    style={{imageRendering: 'pixelated'}}
                    onMouseDown={() => { if (!isPan) mouseEvnetProps.handleMouseDown() }}
                    onMouseMove={(e) => {mouseEvnetProps.handleMouseMove(e)}}
                    onMouseUp={(e) => {mouseEvnetProps.handleMouseUp(e)}}
                    onMouseLeave={(e) => {mouseEvnetProps.handleMouseLeave(e)}}
                >
                    {...(currentFrame?.layers ?? [])
                    .sort((a, b) => a.layerOrder - b.layerOrder)
                    .map((layer) => (
                        <Layer
                        key={layer.id} 
                        id={layer.id} 
                        opacity={layer.opacity / 100}
                        visible={layer.isVisible}>
                        
                        {/* 💡 복잡한 캔버스 생성 및 복원 로직은 이 블랙박스 컴포넌트가 알아서 수행합니다! */}
                        <LayerImageRenderer
                            layerId={layer.id}
                            pixelData={layer.pixelData}
                            preparedCanvas={resizedLayerCanvases.get(layer)}
                            canvasW={canvasProps.width}
                            canvasH={canvasProps.height}
                            currentFrameId={activeFrameId}
                            ensureLayerCanvas={ensureLayerCanvas}
                        />
                        </Layer>
                    ))}
                    {cursorPos.x >= 0 && cursorPos.y >= 0 && (
                    <Layer>
                        {(activeTool === 'pencil' || activeTool === 'eraser' || activeTool === 'shade' || activeTool === 'line' || activeTool === 'rect' || activeTool === 'ellipse') &&(
                            <Rect
                                x={cursorPos.x - offset} // 계산된 offset만큼 이동
                                y={cursorPos.y - offset} // 계산된 offset만큼 이동
                                width={pixelSize}
                                height={pixelSize}
                                fill="rgba(128, 128, 128, 0.6)" // 기준 색상을 흰색으로 설정
                                listening={false}
                            />
                        )}
                        {(activeTool === 'fill' || activeTool ==='eyedrop' || activeTool === 'wand') && (
                            <Rect
                                x={cursorPos.x} // 계산된 offset만큼 이동
                                y={cursorPos.y} // 계산된 offset만큼 이동
                                width={1}
                                height={1}
                                fill="rgba(128, 128, 128, 0.6)" // 기준 색상을 흰색으로 설정
                                listening={false}
                            />
                        )}
                    </Layer>
                    )}
                </Stage>
                </div>

                {/* 그리드 스냅 격자(8·16·32칸) */}
                {selectionProps.gridSnap && (
                    <div className="absolute inset-0 pointer-events-none z-20"
                        style={{
                            backgroundImage: `linear-gradient(rgba(37,99,235,0.55) ${1.5 / zoom}px, transparent 0), linear-gradient(90deg, rgba(37,99,235,0.55) ${1.5 / zoom}px, transparent 0)`,
                            backgroundSize: `${selectionProps.gridSize}px ${selectionProps.gridSize}px`,
                        }} />
                )}
                {/* 선택 테두리(점선이 흐르는 '개미 행렬') + 올가미 그리는 중 */}
                {(selectionProps.outline || selectionProps.lasso) && (
                    <svg className="absolute inset-0 pointer-events-none z-20" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                        {selectionProps.outline && (<>
                            <path d={selectionProps.outline} fill="none" stroke="#ffffff" strokeWidth={1.5 / zoom} />
                            <path d={selectionProps.outline} fill="none" stroke="#111827" strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`}>
                                <animate attributeName="stroke-dashoffset" from="0" to={`${-8 / zoom}`} dur="0.6s" repeatCount="indefinite" />
                            </path>
                        </>)}
                        {selectionProps.lasso && selectionProps.lasso.length > 1 && (
                            <polyline points={selectionProps.lasso.map(p => `${p.x + 0.5},${p.y + 0.5}`).join(' ')}
                                fill="rgba(37,99,235,0.12)" stroke="#2563eb" strokeWidth={1.5 / zoom} />
                        )}
                    </svg>
                )}
                {/* 화면 보조 선(대칭 축·비율 가이드) — 캔버스 좌표 SVG. 확대가 CSS scale이라 non-scaling-stroke가 안 먹음 → 굵기를 1/zoom으로 */}
                {(symmetryX || symmetryY || (ratioGuide && dragShape?.tool === 'line')) && (
                    <svg className="absolute inset-0 pointer-events-none z-20" width={W} height={H}
                        viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'hidden' }}>
                        {symmetryX && <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#ec4899" strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                            strokeWidth={1.5 / zoom} />}
                        {symmetryY && <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#ec4899" strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                            strokeWidth={1.5 / zoom} />}
                        {ratioGuide && dragShape?.tool === 'line' && RATIO_GUIDE_DIRS.map(d => {
                            const n = Math.hypot(d.dx, d.dy);
                            // 계단 선(2:1 등)은 시작 칸의 모서리에서 뻗어야 칸 경계와 맞음(수평·수직은 칸 가운데)
                            const cx = dragShape.start.x + (d.dx === 0 ? 0.5 : d.dx > 0 ? 0 : 1);
                            const cy = dragShape.start.y + (d.dy === 0 ? 0.5 : d.dy > 0 ? 0 : 1);
                            return <line key={`${d.dx},${d.dy}`} x1={cx} y1={cy}
                                x2={cx + d.dx / n * rayLen} y2={cy + d.dy / n * rayLen}
                                stroke={d.label === '1:1' || d.label === '수평' || d.label === '수직' ? '#06b6d4' : '#f59e0b'}
                                strokeOpacity={0.6} strokeWidth={1 / zoom} />;
                        })}
                    </svg>
                )}
            </div>

            {/* 픽셀 카운터·비율 표시(상단 가운데 플로팅) */}
            {dragLabel && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-lg px-3 py-1.5 shadow border text-xs font-bold pointer-events-none"
                    style={{ background: 'rgba(33,38,45,0.9)', borderColor: 'var(--color-outline)',
                        color: dragLabel.clean === false ? 'var(--color-warning)' : 'var(--color-on-surface)' }}>
                    {dragLabel.text}
                </div>
            )}

            {/* 참조 이미지 조절(우상단 플로팅) */}
            {showRef && (
                <div className="absolute top-4 right-4 z-30 rounded-xl border shadow-lg px-3 py-2 flex items-center gap-2 text-xs"
                    style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}
                    onMouseDown={e => e.stopPropagation()}>
                    <span className="font-bold">참조</span>
                    <input type="range" min={5} max={100} value={referenceProps.opacity} aria-label="참조 이미지 투명도"
                        onChange={e => referenceProps.setOpacity(Number(e.target.value))} className="w-20 accent-primary" />
                    <button type="button" onClick={() => referenceProps.setFront(!referenceProps.front)}
                        className="px-2 py-0.5 rounded border font-bold" style={{ borderColor: 'var(--color-outline)' }}>
                        {referenceProps.front ? '그림 위' : '그림 아래'}
                    </button>
                    <button type="button" onClick={referenceProps.close} aria-label="참조 이미지 닫기"
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            )}

            {previewProps.open && (
                <ReadabilityPreview
                    key={previewProps.mode}
                    initialMode={previewProps.mode}
                    frame={currentFrame}
                    width={W}
                    height={H}
                    peekLayerCanvas={previewProps.peekLayerCanvas}
                    onClose={previewProps.onClose}
                />
            )}

            {/* 줌 컨트롤 (하단 중앙 플로팅) */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl px-3 py-1.5 shadow-lg border"
                style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>

            <button onClick={() => setZoomIdx(i => Math.max(0, i-1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container-high"
                style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="material-symbols-outlined text-sm">remove</span>
            </button>
            <span className="text-xs font-bold w-12 text-center">x{zoom}</span>
            <button onClick={() => setZoomIdx(i => Math.min(ZOOM_LEVELS.length-1, i+1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container-high"
                style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="material-symbols-outlined text-sm">add</span>
            </button>
            </div>

            {/* 커서 위치 (우하단 플로팅) */}
            <div className="absolute bottom-8 right-4 rounded-lg px-3 py-1.5 shadow border text-xs font-bold"
                style={{ background: 'rgba(33,38,45,0.9)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                {cursorPos.x >= 0 ? `x: ${cursorPos.x}  y: ${cursorPos.y}` : 'x: —  y: —'}
            </div>
        </main>
    )
}