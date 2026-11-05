import { DRAW_TOOLS } from "../../../constants/editor/editor";
import { EditorToolId, Point } from "../../../type/editor";
import React, { useCallback, useState } from "react";
import { BrushOptions, floodFill, stampBrush } from "../../../utils/pixelBrush";

interface UseCanvasTool {
    fgColor: string;
    isDirty: React.RefObject<boolean>;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
    selectPaletteColor: (color: string) => void;
}
export function useCanvasTool({
  fgColor,
  isDirty,
  setUnsaved,
  selectPaletteColor,
}: UseCanvasTool){
    const [activeTool, setActiveTool]   = useState<EditorToolId>(DRAW_TOOLS[0].id); // 기본 도구는 연필(pencil)
    const [pixelSize, setPixelSize] = useState(1);
    const [brushSize, setBrushSize]     = useState(1);
    const [pixelPerfect, setPixelPerfect] = useState(true);

    // ── 도구 옵션(PR-A) ── 채움 도형·투명 픽셀 잠금·체크무늬·대칭
    const [shapeFill, setShapeFill] = useState(false);
    const [alphaLock, setAlphaLock] = useState(false);
    const [dither, setDither] = useState(false);
    const [symmetryX, setSymmetryX] = useState(false);
    const [symmetryY, setSymmetryY] = useState(false);

    /** 지금 도구로 붓을 찍을 때 쓸 옵션(연필·직선·도형 = 전경색, 지우개 = 지우기) */
    const brushOptions = useCallback((erase: boolean): BrushOptions => ({
        size: pixelSize,
        color: erase ? null : fgColor,
        alphaLock,
        dither,
        symmetryX,
        symmetryY,
    }), [pixelSize, fgColor, alphaLock, dither, symmetryX, symmetryY]);

    // -------- 활성 프레임의 활성 레이어에 대한 캔버스에다가 픽셀 도구 효과를 적용하는 로직 -----------
    const applyDirectTool = useCallback((ctx: CanvasRenderingContext2D, pos : Point | null) => {
        if (!ctx || !pos) return
    
        const { x, y } = pos;
        const {width, height} = ctx.canvas;
        if (x < 0 || x >= width || y < 0 || y >= height) return
    
        // ─── [연필·지우개] ── 크기·투명 잠금·체크무늬·대칭은 stampBrush가 처리
        if (activeTool === 'pencil' || activeTool === 'eraser') {
          stampBrush(ctx, x, y, brushOptions(activeTool === 'eraser'));
          isDirty.current = true; // 픽셀이 변경되었음을 표시
          setUnsaved(true);
        }
        // ─── [페인트 통 도구 (Fill)] ── 같은 색 이어진 칸(4방향), 옵션은 floodFill이 처리
        else if (activeTool === 'fill') {
          if (floodFill(ctx, x, y, fgColor, { alphaLock, dither, symmetryX, symmetryY })) {
            isDirty.current = true;
            setUnsaved(true);
          }
        }
      
        // ─── [스포이트 도구 (Eyedropper)] ──────────────────────────
        else if (activeTool === 'eyedrop') {
          const imgData = ctx.getImageData(x, y, 1, 1).data;
          // 투명한 영역(알파값 0)을 찍으면 기본 검정 처리 혹은 스킵
          if (imgData[3] !== 0) {
            const r = imgData[0].toString(16).padStart(2, '0');
            const g = imgData[1].toString(16).padStart(2, '0');
            const b = imgData[2].toString(16).padStart(2, '0');
            const pickedHex = `#${r}${g}${b}`;
            
            // 앞서 만든 단일 진입점 변경 함수 호출!
            selectPaletteColor(pickedHex);
          }
          return;
        }
    }, [activeTool, fgColor, alphaLock, dither, symmetryX, symmetryY, brushOptions, isDirty, setUnsaved, selectPaletteColor]);

    return {activeTool, pixelSize, brushSize, pixelPerfect, setActiveTool, setPixelSize, setBrushSize, setPixelPerfect, applyDirectTool,
      brushOptions,
      toolOptions: { shapeFill, alphaLock, dither, symmetryX, symmetryY },
      setToolOptions: { setShapeFill, setAlphaLock, setDither, setSymmetryX, setSymmetryY },
    }
}
