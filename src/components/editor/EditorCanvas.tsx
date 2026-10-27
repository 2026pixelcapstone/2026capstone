import { FrameData, Point } from "../../type/editor";
import { KonvaEventObject } from "konva/lib/Node";
import { LayerImageRenderer } from "./LayerImageRender";
import { Layer, Rect, Stage } from "react-konva";
import Konva from "konva";
import { resizedLayerCanvases } from "../../utils/resizedLayerCanvas";
import React from "react";
import { ZOOM_LEVELS } from "../../constants/editor/editor";

interface EditorCanvasProps{
    activeFrameId: string | null;
    zoom: number;
    showGridLines: boolean;
    cursorPos: Point;
    stageRef: React.RefObject<Konva.Stage | null>;
    currentFrame: FrameData;
    setZoomIdx: React.Dispatch<React.SetStateAction<number>>;
    ensureLayerCanvas: (cachekey: string) => HTMLCanvasElement | null;
    canvasProps: CanvasProps;
    mouseEvnetProps: MouseEventProps;
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
    activeFrameId,
    zoom,
    showGridLines,
    cursorPos,
    stageRef,
    currentFrame,
    setZoomIdx,
    ensureLayerCanvas,
    canvasProps,
    mouseEvnetProps,
}: EditorCanvasProps){

    {/* 바깥 배경: 캔버스보다 약간 진한 중간 회색 (체커보드) */}
    return(
        <main className="flex-1 flex items-center justify-center overflow-hidden relative"
            style={{
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
                transform: `scale(${zoom})`,
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
                onMouseDown={() => {mouseEvnetProps.handleMouseDown()}}
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
                    <Rect
                    x={cursorPos.x}
                    y={cursorPos.y}
                    width={1}
                    height={1}
                    fill="rgba(128, 128, 128, 0.6)" // 기준 색상을 흰색으로 설정
                    listening={false}
                    />
                </Layer>
                )}
            </Stage>
            </div>

            {/* 줌 컨트롤 (하단 중앙 플로팅) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl px-3 py-1.5 shadow-lg border"
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
            <div className="absolute bottom-4 right-4 rounded-lg px-3 py-1.5 shadow border text-xs font-bold"
            style={{ background: 'rgba(33,38,45,0.9)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
            {cursorPos.x >= 0 ? `x: ${cursorPos.x}  y: ${cursorPos.y}` : 'x: —  y: —'}
            </div>
        </main>
    )
}