import { DRAW_TOOLS } from "../../../constants/editor/editor";
import { EditorToolId, Point } from "../../../type/editor";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { BrushOptions, brushCells, floodFill, stampBrush } from "../../../utils/pixelBrush";
import { hexToRgb, rgbToHex } from "../../../utils/pixelOps";

interface UseCanvasTool {
    fgColor: string;
    isDirty: React.RefObject<boolean>;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
    selectPaletteColor: (color: string) => void;
    selectionRef?: React.RefObject<{ mask: Uint8Array } | null>;   // 선택이 있으면 채우기도 그 안에서만(PR-D)
    paletteColors?: string[];   // 명암 펜이 밝기 순으로 한 칸씩 옮겨 다닐 색(PR-G)
}

const lum = (hex: string) => { const [r, g, b] = hexToRgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** 색상(0~360)·채도(0~1) */
function hueSat(hex: string): [number, number] {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d === 0) return [0, 0];
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, mx === 0 ? 0 : d / mx];
}
/**
 * 명암 펜(PR-G): 팔레트에서 지금 색보다 밝은(어두운) 색 중 '가장 비슷한 색 계열의 바로 다음 단계'.
 * 밝기 순만 쓰면 섞인 팔레트에서 파랑 → 초록처럼 튀므로 색상·채도 차이를 먼저 보고, 밝기 차이가 작은 쪽을 고름.
 */
export function nextShade(hex: string, darker: boolean, palette: string[]): string | null {
    const L = lum(hex);
    const [h, s] = hueSat(hex);
    let best: string | null = null, bestScore = Infinity;
    for (const c of palette) {
        const dl = lum(c) - L;
        if (darker ? dl >= -2 : dl <= 2) continue;   // 한쪽 방향만, 거의 같은 밝기는 제외
        const [ch, cs] = hueSat(c);
        const grayish = s < 0.12 || cs < 0.12;
        const dh = grayish ? (s < 0.12 && cs < 0.12 ? 0 : 0.5) : Math.min(Math.abs(ch - h), 360 - Math.abs(ch - h)) / 180;
        const score = dh * 2 + Math.abs(cs - s) + Math.abs(dl) / 255;
        if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
}
export function useCanvasTool({
  fgColor,
  isDirty,
  setUnsaved,
  selectPaletteColor,
  selectionRef,
  paletteColors = [],
}: UseCanvasTool){
    const [activeTool, setActiveTool]   = useState<EditorToolId>(DRAW_TOOLS[0].id); // 기본 도구는 연필(pencil)
    const [pixelSize, setPixelSize] = useState(1);
    const [brushSize, setBrushSize]     = useState(1);
    const [pixelPerfect, setPixelPerfect] = useState(false);   // 기본 꺼짐(Aseprite와 같음, 팀원 확인 11-06)

    // ── 도구 옵션(PR-A) ── 채움 도형·투명 픽셀 잠금·체크무늬·대칭
    const [shapeFill, setShapeFill] = useState(false);
    const [alphaLock, setAlphaLock] = useState(false);
    const [dither, setDither] = useState(false);
    const [symmetryX, setSymmetryX] = useState(false);
    const [symmetryY, setSymmetryY] = useState(false);
    // ── PR-G ── 채우기·마술봉 영역(이어진 칸만/같은 색 전부, 허용 오차), 명암 펜 방향, 타일 모드
    const [contiguous, setContiguous] = useState(true);
    const [tolerance, setTolerance] = useState(0);
    const [shadeDarken, setShadeDarken] = useState(false);
    const [wrap, setWrap] = useState(false);
    // 명암 펜: 한 번 그을 때 같은 칸을 여러 번 바꾸지 않게(획마다 비움)
    const shadeDone = useRef<Set<number>>(new Set());
    const startStroke = useCallback(() => { shadeDone.current = new Set(); }, []);
    // 명암 펜이 고를 팔레트 색(#rrggbb, 중복 제거)
    const ramp = useMemo(() =>
        [...new Set(paletteColors.map(c => c.slice(0, 7).toLowerCase()))].filter(c => /^#[0-9a-f]{6}$/.test(c)),
    [paletteColors]);

    /** 지금 도구로 붓을 찍을 때 쓸 옵션(연필·직선·도형 = 전경색, 지우개 = 지우기) */
    const brushOptions = useCallback((erase: boolean): BrushOptions => ({
        size: pixelSize,
        color: erase ? null : fgColor,
        alphaLock,
        dither,
        symmetryX,
        symmetryY,
        wrap,
    }), [pixelSize, fgColor, alphaLock, dither, symmetryX, symmetryY, wrap]);

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
          if (floodFill(ctx, x, y, fgColor, { alphaLock, dither, symmetryX, symmetryY, contiguous, tolerance, mask: selectionRef?.current?.mask ?? null })) {
            isDirty.current = true;
            setUnsaved(true);
          }
        }
      
        // ─── [명암 펜(PR-G)] ── 칠해진 칸을 팔레트의 비슷한 색 계열에서 한 단계 밝게(또는 어둡게). 빈 칸은 그대로
        else if (activeTool === 'shade') {
          if (ramp.length < 2) return;
          const cells = brushCells(x, y, brushOptions(false), width, height);
          let any = false;
          for (const c of cells) {
            const k = c.y * width + c.x;
            if (shadeDone.current.has(k)) continue;
            shadeDone.current.add(k);
            const d = ctx.getImageData(c.x, c.y, 1, 1).data;
            if (d[3] === 0) continue;
            const next = nextShade(rgbToHex(d[0], d[1], d[2]), shadeDarken, ramp);
            if (!next) continue;
            ctx.clearRect(c.x, c.y, 1, 1);
            ctx.fillStyle = next;
            ctx.fillRect(c.x, c.y, 1, 1);
            any = true;
          }
          if (any) { isDirty.current = true; setUnsaved(true); }
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
    }, [activeTool, fgColor, alphaLock, dither, symmetryX, symmetryY, brushOptions, isDirty, setUnsaved, selectPaletteColor, selectionRef, contiguous, tolerance, ramp, shadeDarken]);

    return {activeTool, pixelSize, brushSize, pixelPerfect, setActiveTool, setPixelSize, setBrushSize, setPixelPerfect, applyDirectTool,
      brushOptions,
      toolOptions: { shapeFill, alphaLock, dither, symmetryX, symmetryY, contiguous, tolerance, shadeDarken, wrap },
      setToolOptions: { setShapeFill, setAlphaLock, setDither, setSymmetryX, setSymmetryY, setContiguous, setTolerance, setShadeDarken, setWrap },
      startStroke,
    }
}
