import { Point } from "../../../type/editor";
import { constrainSquare, ellipsePoints, rectPoints } from "../../../utils/pixelBrush";
import { useCallback, useRef } from "react";

export type ShapeKind = 'rect' | 'ellipse';

export interface DrawShapeOptions {
    kind: ShapeKind;
    filled: boolean;
    square: boolean;   // Shift: 정사각형·정원
    plot: (ctx: CanvasRenderingContext2D, pt: Point) => void;
    plotSpan: (ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number) => void;   // 채움: 줄 단위로 한 번에
}

/**
 * 사각형·원 도구 — 직선 도구(useDrawLine)와 같은 방식:
 * 누를 때 레이어를 통째로 백업 → 끄는 동안 백업으로 되돌린 뒤 새 도형을 미리 그림 → 뗄 때 그 상태가 남음.
 */
export function useDrawShape() {
    const startPos = useRef<Point | null>(null);
    const snapshot = useRef<ImageData | null>(null);

    const startShape = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, pos: Point, plot: DrawShapeOptions['plot']) => {
        startPos.current = pos;
        snapshot.current = ctx.getImageData(0, 0, width, height);
        plot(ctx, pos);   // 누르기만 해도 한 칸은 보이게
    }, []);

    /** @returns 실제로 그린 끝점(Shift 보정 반영) — 픽셀 카운터 표시용 */
    const updateShape = useCallback((ctx: CanvasRenderingContext2D, pos: Point, o: DrawShapeOptions): Point | null => {
        const start = startPos.current;
        if (!start || !snapshot.current) return null;
        ctx.putImageData(snapshot.current, 0, 0);
        const end = o.square ? constrainSquare(start, pos) : pos;
        const pts = o.kind === 'rect' ? rectPoints(start, end, o.filled) : ellipsePoints(start, end, o.filled);
        if (o.filled) {
            // 채움 도형은 줄마다 한 구간 → 칸마다 찍지 않고 줄마다 한 번(큰 캔버스에서 끌 때 느려지지 않게)
            const rows = new Map<number, { min: number; max: number }>();
            for (const p of pts) {
                const r = rows.get(p.y);
                if (!r) rows.set(p.y, { min: p.x, max: p.x });
                else { r.min = Math.min(r.min, p.x); r.max = Math.max(r.max, p.x); }
            }
            rows.forEach((r, y) => o.plotSpan(ctx, r.min, r.max, y));
        } else {
            for (const p of pts) o.plot(ctx, p);
        }
        return end;
    }, []);

    const endShape = useCallback(() => {
        const had = Boolean(startPos.current);
        startPos.current = null;
        snapshot.current = null;
        return had;
    }, []);

    return { startShape, updateShape, endShape };
}
