import { CanvasState, Point } from "../../type/editor";
import { getCacheKey } from "../../utils/editorUtils";
import Konva from "konva";
import { KonvaEventObject } from "konva/lib/Node";
import React, { SetStateAction, useCallback, useRef, useState } from "react";
import { useDrawLine } from "./canvasTool/useDrawLine";

interface UseCanvasDrawing{
    stageRef: React.RefObject<Konva.Stage | null>;
    isDirty: React.RefObject<boolean>;
    state: CanvasState;
    activeFrameId: string | null;
    activeLayerId: string | null;
    activeTool: string | null;
    fgColor: string;
    brushSize: number;
    setUnsaved: React.Dispatch<SetStateAction<boolean>>;
    commitLayerChanges: (frameId: string | null, layerId: string | null) => void;
    applyDirectTool: (ctx: CanvasRenderingContext2D, pos: Point | null) => void
    ensureLayerCanvas: (cachekey: string) => HTMLCanvasElement | null;
}

export function useCanvasDrawing({
    stageRef,
    state,
    isDirty,
    activeFrameId,
    activeLayerId,
    activeTool,
    brushSize,
    fgColor,
    setUnsaved,
    commitLayerChanges,
    applyDirectTool,
    ensureLayerCanvas,
    
}: UseCanvasDrawing){
    const drawingTarget = useRef<{ frameId: string; layerId: string; ctx: CanvasRenderingContext2D; } | null>(null);
    const isDrawing = useRef(false);
    const [cursorPos, setCursorPos] = useState<Point>({
        x: -1, 
        y: -1,
    });
    const {startLine, updateLine, endLine} = useDrawLine();

    //-------- 현재 픽셀의 정확한 위치를 넘겨주는 역할 -----------
    const getPixel = useCallback(() : Point | null => {
        const stage = stageRef.current;
        if (!stage) return null
    
        // 마우스 커서의 좌표 가져옴
        const relativePos = stage.getRelativePointerPosition(); // 도화지 기준 상대 좌표 추출
        if(!relativePos) return null;
        
        // 정확한 픽셀 인덱스 좌표를 계산
        const x = Math.floor(relativePos.x);
        const y = Math.floor(relativePos.y);
    
        // 도화지 영역 밖을 벗어난 마우스 좌표는 무시 (클리핑 방어)
        if (x < 0 || x >= state.width || y < 0 || y >= state.height) {
          return null;
        }
    
        return {x, y};
      }, [state.width, state.height])
      
      //-------- 마우스 동작 -----------
      const handleMouseDown = () => {
        isDrawing.current = true;        
        const pos = getPixel();

        if(!pos || !activeFrameId || !activeLayerId) return;

        const nativeCanvas = ensureLayerCanvas(getCacheKey(activeFrameId, activeLayerId));
        const ctx = nativeCanvas?.getContext('2d');

        if(!ctx) return;
        drawingTarget.current = { frameId: activeFrameId, layerId: activeLayerId, ctx };
        
        isDrawing.current = true;
        isDirty.current = false;
        if(activeTool === 'line'){
            startLine(ctx, state.width, state.height, pos,
              {
                brushSize,
                color: fgColor,
                snapAngle: false, // Shift 키는 마우스 이동 중에만 적용
              }
            );
            isDirty.current = true;
            return;
        }
        applyDirectTool(ctx, pos);
      }
      
    const handleMouseMove = (e : KonvaEventObject<MouseEvent>) => {
        const pos = getPixel();
        if (!pos || !activeFrameId || !activeLayerId) return;
        setCursorPos(pos);
    
        const target = drawingTarget.current;
        if (!isDrawing.current || !target) return;

        if (activeTool === 'line') {
            updateLine(target.ctx, pos, {
                brushSize,
                color: fgColor,
                snapAngle: e.evt.shiftKey,
            });
            // 화면 갱신
            stageRef.current?.findOne(`#${target.layerId}`)?.getLayer()?.batchDraw();
            return;
        }
        
        if(activeTool === 'pencil' || activeTool === 'eraser'){
          applyDirectTool(target.ctx, pos);
          stageRef.current?.findOne(`#${target.layerId}`)?.getLayer()?.batchDraw();
          return;
        }
    };
    
    const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
        isDrawing.current = false;
        const target = drawingTarget.current;
        if(target){
          const pos = e ? getPixel() : null;
          if (e && pos) {
            if(activeTool === 'line'){
                updateLine(target.ctx, pos, {
                    brushSize,
                    color: fgColor,
                    snapAngle: e.evt.shiftKey,
                });
                stageRef.current?.findOne(`#${target?.layerId}`)?.getLayer()?.batchDraw();
            }
          }
          const isCommitted = endLine();
          drawingTarget.current = null;
          if(isCommitted){
            isDirty.current = true;
            setUnsaved(true);
          }
        }
        // 실제로 변경이 발생했을 때만 커밋 호출
        if(isDirty.current){
            commitLayerChanges(target?.frameId ?? activeFrameId, target?.layerId ?? activeLayerId);
            isDirty.current = false;
        }
    }

    const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
        handleMouseUp(e);
        setCursorPos({ x: -1, y: -1 });
    }
    return {cursorPos, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave}
}