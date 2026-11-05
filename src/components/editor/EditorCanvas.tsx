import { EditorToolId, FrameData, Point } from "../../type/editor";
import { KonvaEventObject } from "konva/lib/Node";
import { LayerImageRenderer } from "./LayerImageRender";
import { Image as KonvaImage, Layer, Rect, Stage } from "react-konva";
import Konva from "konva";
import { resizedLayerCanvases } from "../../utils/resizedLayerCanvas";
import React from "react";
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
interface PreviewProps{
    open: boolean;
    onClose: () => void;
    peekLayerCanvas: (cacheKey: string) => HTMLCanvasElement | null;
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
}: EditorCanvasProps){

    const offset = Math.floor((pixelSize - 1) / 2);
    const isPan = activeTool === 'pan';
    const { dragShape, pixelCounter, ratioGuide, symmetryX, symmetryY } = overlayProps;
    const W = canvasProps.width, H = canvasProps.height;

    // 끄는 중인 직선·도형 정보(픽셀 카운터·비율 가이드)
    const dragLabel = (() => {
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
            cursor: isPan ? (panProps.panning ? 'grabbing' : 'grab') : undefined,
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
                    {(onionProps.prev || onionProps.next) && (
                        <Layer listening={false} opacity={0.35}>
                            {onionProps.prev && <KonvaImage image={onionProps.prev} x={0} y={0} />}
                            {onionProps.next && <KonvaImage image={onionProps.next} x={0} y={0} />}
                        </Layer>
                    )}
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
                        {(activeTool === 'pencil' || activeTool === 'eraser' || activeTool === 'line' || activeTool === 'rect' || activeTool === 'ellipse') &&(
                            <Rect
                                x={cursorPos.x - offset} // 계산된 offset만큼 이동
                                y={cursorPos.y - offset} // 계산된 offset만큼 이동
                                width={pixelSize}
                                height={pixelSize}
                                fill="rgba(128, 128, 128, 0.6)" // 기준 색상을 흰색으로 설정
                                listening={false}
                            />
                        )}
                        {(activeTool === 'fill' || activeTool ==='eyedrop') && (
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

            {previewProps.open && (
                <ReadabilityPreview
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