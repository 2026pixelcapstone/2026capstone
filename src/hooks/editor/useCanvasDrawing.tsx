import { CanvasState, EditorToolId, Point } from "../../type/editor";
import { getCacheKey } from "../../utils/editorUtils";
import Konva from "konva";
import { KonvaEventObject } from "konva/lib/Node";
import React, { SetStateAction, useCallback, useRef, useState } from "react";
import { snapToAngles, useDrawLine } from "./canvasTool/useDrawLine";
import { useDrawShape } from "./canvasTool/useDrawShape";
import { getBresenhamPoints } from "../../utils/pixelAlgorithm";
import { BrushOptions, brushCells, stampBrush } from "../../utils/pixelBrush";

interface UseCanvasDrawing{
    stageRef: React.RefObject<Konva.Stage | null>;
    isDirty: React.RefObject<boolean>;
    state: CanvasState;
    activeFrameId: string | null;
    activeLayerId: string | null;
    activeTool: EditorToolId;
    fgColor: string;
    pixelSize: number;
    pixelPerfect: boolean;
    shapeFill: boolean;
    brushOptions: (erase: boolean) => BrushOptions;
    setUnsaved: React.Dispatch<SetStateAction<boolean>>;
    commitLayerChanges: (frameId: string | null, layerId: string | null) => void;
    applyDirectTool: (ctx: CanvasRenderingContext2D, pos: Point | null) => void
    ensureLayerCanvas: (cachekey: string) => HTMLCanvasElement | null;
}

/** 끄는 중인 직선·도형(픽셀 카운터·비율 가이드 표시용) */
export interface DragShape {
    tool: 'line' | 'rect' | 'ellipse';
    start: Point;
    end: Point;
}

/** 픽셀 퍼펙트 — 지나간 칸과 그 칸을 칠하기 전 색 */
interface TrailCell { p: Point; saved: { x: number; y: number; rgba: ImageData }[] }

const isShapeTool = (t: EditorToolId): t is 'rect' | 'ellipse' => t === 'rect' || t === 'ellipse';

export function useCanvasDrawing({
    stageRef,
    state,
    isDirty,
    activeFrameId,
    activeLayerId,
    activeTool,
    fgColor,
    pixelSize,
    pixelPerfect,
    shapeFill,
    brushOptions,
    setUnsaved,
    commitLayerChanges,
    applyDirectTool,
    ensureLayerCanvas,

}: UseCanvasDrawing){
    const lastPos = useRef<Point>(null);
    const drawingTarget = useRef<{ frameId: string; layerId: string; ctx: CanvasRenderingContext2D; } | null>(null);
    const isDrawing = useRef(false);
    const trail = useRef<TrailCell[]>([]);
    const [cursorPos, setCursorPos] = useState<Point>({
        x: -1,
        y: -1,
    });
    const [dragShape, setDragShape] = useState<DragShape | null>(null);
    const {startLine, updateLine, endLine} = useDrawLine();
    const {startShape, updateShape, endShape} = useDrawShape();

    // 직선·도형이 칸 하나를 찍는 방법 — 연필과 같은 붓(크기·대칭·체크무늬·투명 잠금)
    const plot = useCallback((ctx: CanvasRenderingContext2D, pt: Point) => {
        stampBrush(ctx, pt.x, pt.y, brushOptions(false));
    }, [brushOptions]);

    // 픽셀 퍼펙트는 1칸 연필·체크무늬 없음일 때만(굵은 붓·체크무늬에선 L자 꺾임 개념이 없음)
    const pixelPerfectOn = (tool: EditorToolId) => {
        if (!pixelPerfect || tool !== 'pencil' || pixelSize !== 1) return false;
        return !brushOptions(false).dither;
    };

    /**
     * 픽셀 퍼펙트 연필 한 칸: 칠하기 전 색을 저장 → 칠함 → 직전 칸이 L자 꺾임(앞·뒤 칸이 대각선)이면 직전 칸을 원래 색으로 되돌림.
     * 자유곡선에서 생기는 '두꺼운 모서리'를 없애는 픽셀아트 기본 처리(Aseprite 'Pixel-perfect').
     */
    const paintPixelPerfect = (ctx: CanvasRenderingContext2D, pt: Point) => {
        const t = trail.current;
        const last = t[t.length - 1];
        if (last && last.p.x === pt.x && last.p.y === pt.y) return;
        const { width, height } = ctx.canvas;
        const saved = brushCells(pt.x, pt.y, brushOptions(false), width, height)
            .map(c => ({ x: c.x, y: c.y, rgba: ctx.getImageData(c.x, c.y, 1, 1) }));
        applyDirectTool(ctx, pt);
        t.push({ p: pt, saved });
        if (t.length >= 3) {
            const a = t[t.length - 3].p, b = t[t.length - 2], c = pt;
            const diagonal = Math.abs(a.x - c.x) === 1 && Math.abs(a.y - c.y) === 1;
            const corner = (b.p.x === a.x && b.p.y === c.y) || (b.p.y === a.y && b.p.x === c.x);
            if (diagonal && corner) {
                for (const s of b.saved) ctx.putImageData(s.rgba, s.x, s.y);
                t.splice(t.length - 2, 1);
            }
        }
        if (t.length > 3) t.splice(0, t.length - 3);
    };

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
      }, [stageRef, state.width, state.height])

      const redrawLayer = (layerId: string) => {
        stageRef.current?.findOne(`#${layerId}`)?.getLayer()?.batchDraw();
      };

      //-------- 마우스 동작 -----------
      const handleMouseDown = () => {
        if (activeTool === 'pan') return;   // 화면 이동은 EditorCanvas가 처리
        const pos = getPixel();

        if(!pos || !activeFrameId || !activeLayerId) return;

        const nativeCanvas = ensureLayerCanvas(getCacheKey(activeFrameId, activeLayerId));
        const ctx = nativeCanvas?.getContext('2d');

        if(!ctx) return;
        drawingTarget.current = { frameId: activeFrameId, layerId: activeLayerId, ctx };

        isDrawing.current = true;
        isDirty.current = false;
        lastPos.current = pos;
        trail.current = [];
        if(activeTool === 'line'){
            startLine(ctx, state.width, state.height, pos,
              {
                pixelSize,
                color: fgColor,
                snapAngle: false, // Shift 키는 마우스 이동 중에만 적용
                plot,
              }
            );
            isDirty.current = true;
            setDragShape({ tool: 'line', start: pos, end: pos });
            redrawLayer(activeLayerId);
            return;
        }
        if (isShapeTool(activeTool)) {
            startShape(ctx, state.width, state.height, pos, plot);
            isDirty.current = true;
            setDragShape({ tool: activeTool, start: pos, end: pos });
            redrawLayer(activeLayerId);
            return;
        }
        if (pixelPerfectOn(activeTool)) paintPixelPerfect(ctx, pos);
        else applyDirectTool(ctx, pos);
        redrawLayer(activeLayerId);
      }

    const handleMouseMove = (e : KonvaEventObject<MouseEvent>) => {
        const pos = getPixel();
        if (!pos || !activeFrameId || !activeLayerId) return;
        setCursorPos(pos);

        const target = drawingTarget.current;
        if (!isDrawing.current || !target) return;

        if (activeTool === 'line') {
            updateLine(target.ctx, pos, {
                pixelSize,
                color: fgColor,
                snapAngle: e.evt.shiftKey,
                plot,
            });
            setDragShape(d => d && { ...d, end: e.evt.shiftKey ? snapToAngles(d.start, pos) : pos });
            // 화면 갱신
            redrawLayer(target.layerId);
            return;
        }

        if (isShapeTool(activeTool)) {
            const end = updateShape(target.ctx, pos, { kind: activeTool, filled: shapeFill, square: e.evt.shiftKey, plot });
            if (end) setDragShape(d => d && { ...d, end });
            redrawLayer(target.layerId);
            return;
        }

        if(activeTool === 'pencil' || activeTool === 'eraser'){
          const pp = pixelPerfectOn(activeTool);
          // 이전 점과 현재 점 사이를 잇는 커스텀 로직 호출 (브레슨햄 알고리즘 등)
          if (lastPos.current) {
              // 1. 이전 위치와 현재 위치 사이의 픽셀 좌표들을 계산
              const points = getBresenhamPoints(
                  lastPos.current.x,
                  lastPos.current.y,
                  pos.x,
                  pos.y
              );

              // 2. 계산된 모든 픽셀 좌표에 대해 도구를 적용 (점 찍기)
              points.forEach(point => {
                  if (pp) paintPixelPerfect(target.ctx, point);
                  else applyDirectTool(target.ctx, point);
              });
          } else {
              // 혹시 lastPos가 없다면 현재 점만 찍음
              if (pp) paintPixelPerfect(target.ctx, pos);
              else applyDirectTool(target.ctx, pos);
          }

          // 현재 점을 다음 move 이벤트를 위한 이전 점으로 저장
          lastPos.current = pos;
          isDirty.current = true;
          redrawLayer(target.layerId);
          return;
        }
    };

    const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
        isDrawing.current = false;
        lastPos.current = null;
        trail.current = [];
        setDragShape(null);
        const target = drawingTarget.current;
        if(target){
          const pos = e ? getPixel() : null;
          if (e && pos) {
            if(activeTool === 'line'){
                updateLine(target.ctx, pos, {
                    pixelSize,
                    color: fgColor,
                    snapAngle: e.evt.shiftKey,
                    plot,
                });
                redrawLayer(target.layerId);
            } else if (isShapeTool(activeTool)) {
                updateShape(target.ctx, pos, { kind: activeTool, filled: shapeFill, square: e.evt.shiftKey, plot });
                redrawLayer(target.layerId);
            }
          }
          const isCommitted = endLine() || endShape();
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
    return {cursorPos, dragShape, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave}
}
