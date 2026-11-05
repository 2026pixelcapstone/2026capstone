import { Point } from "../type/editor";

// ─── 브레젠험 기본 보간 알고리즘 ─────────────────────
export function getBresenhamPoints(x0: number, y0: number, x1: number, y1: number) {
    const points: Point[] = [];
    // 브레젠험 알고리즘을 사용하여 두 점 사이의 픽셀 좌표를 계산
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);

    // 브레젠험 알고리즘의 방향 결정
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy; // 오차 누적 변수
    
    let cx = x0;
    let cy = y0;

    // (cx, cy) 좌표를 (x1, y1)까지 이동시키며 픽셀 좌표를 points 배열에 추가
    while(true){
        points.push({x: cx, y: cy});
        if(cx == x1 && cy == y1) break;

        const e2 = 2 * err; // 오차를 두 배로 계산
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