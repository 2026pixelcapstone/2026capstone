import { Point } from "../../type/editor";
import { useCallback, useRef } from "react";

export interface DrawLineOptions{
    brushSize?: number;
    color: string;
    snapAngle?: boolean; // Shift 키 등으로 0도, 45도, 90도 각도 제한 여부
    centerBrush?: boolean; // 브러시 크기 확대 시 중심 기준 정렬 여부
}

// ─── 브레젠험 기본 보간 알고리즘 ─────────────────────
function getBresenhamPoints(x0: number, y0: number, x1: number, y1: number) {
    const points: Point[] = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while(true){
        points.push({x: cx, y: cy});
        if(cx == x1 && cy == y1) break;

        const e2 = 2 * err;
        if(e2 > -dy){
            err -= dy;
            cx += sx;
        }
        if(e2 < dx){
            err += dx;
            cy += sy;
        }
    }
    return points;
}

// ─── Shift 키 대응 (0도, 45도, 90도 스냅 계산) ───────
function snapToAngles(start: Point, end: Point): Point {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // 1) 수직선 (90도)
    if (absDx < absDy * 0.414) {
        return { x: start.x, y: end.y };
    }
    // 2) 수평선 (0도)
    if (absDy < absDx * 0.414) {
        return { x: end.x, y: start.y };
    }
    // 3) 대각선 (45도)
    const dist = Math.round((absDx + absDy) / 2);
    return {
        x: start.x + (dx >= 0 ? dist : -dist),
        y: start.y + (dy >= 0 ? dist : -dist),
    };
}

export function useDrawLine(){
    const startPos = useRef<Point | null>(null);
    const snapshot = useRef<ImageData | null>(null);

    // 드래그 시작 시점: 시작점 기록 및 캔버스 백업
    const startLine = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, pos: Point) => {
        startPos.current = pos;
        snapshot.current = ctx.getImageData(0, 0, width, height);
    }, []);

    // 드래그 중: 이전 스냅샷 복구 후 실시간 미리보기 렌더링
    const updateLine = useCallback((
        ctx: CanvasRenderingContext2D,
        currentPos: Point,
        options: DrawLineOptions
    ) => {
        if (!startPos.current || !snapshot.current) return;

        const {
            brushSize = 1,
            color,
            snapAngle = false,
            centerBrush = true,
        } = options;

        // 1. 이전 잔상 캔버스 원본으로 롤백
        ctx.putImageData(snapshot.current, 0, 0);

        // 2. 각도 보정(Shift) 적용
        const endPoint = snapAngle
        ? snapToAngles(startPos.current, currentPos)
        : currentPos;

        // 3. 브레젠험 픽셀 좌표 리스트 산출
        const points = getBresenhamPoints(
            startPos.current.x,
            startPos.current.y,
            endPoint.x,
            endPoint.y
        );

        // 4. 브러시 크기 오프셋 계산 (중심 정렬 여부)
        const offset = centerBrush ? Math.floor((brushSize - 1) / 2) : 0;

        // 5. 픽셀 도포
        ctx.fillStyle = color;
        for (const pt of points) {
        ctx.fillRect(pt.x - offset, pt.y - offset, brushSize, brushSize);
        }
    }, []);

    // 드래그 종료 시점: 상태 초기화 및 완료 여부 반환
    const endLine = useCallback(() => {
        const hadDrawn = Boolean(startPos.current);
        startPos.current = null;
        snapshot.current = null;
        return hadDrawn; // 실제로 선이 그려졌는지 여부 반환
    }, []);

    const isDrawingLine = useCallback(() => Boolean(startPos.current), []);

    return {
        startLine,
        updateLine,
        endLine,
        isDrawingLine,
    };
}