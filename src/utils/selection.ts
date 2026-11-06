import { Point } from "../type/editor";
import { getBresenhamPoints } from "./pixelAlgorithm";

/**
 * 선택 영역(PR-D) — 칸마다 0/1인 마스크. 사각·올가미·모두 선택이 같은 형식이라
 * 점선 테두리 표시·그리기 제한(clip)·채우기 제한·이동·복사가 모두 이 하나를 씀.
 */
export interface Selection {
    w: number;
    h: number;
    mask: Uint8Array;
    bounds: { x0: number; y0: number; x1: number; y1: number };   // 포함 범위
}

function withBounds(w: number, h: number, mask: Uint8Array): Selection | null {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { w, h, mask, bounds: { x0, y0, x1, y1 } };
}

export function rectSelection(a: Point, b: Point, w: number, h: number): Selection | null {
    const mask = new Uint8Array(w * h);
    const x0 = Math.max(0, Math.min(a.x, b.x)), x1 = Math.min(w - 1, Math.max(a.x, b.x));
    const y0 = Math.max(0, Math.min(a.y, b.y)), y1 = Math.min(h - 1, Math.max(a.y, b.y));
    for (let y = y0; y <= y1; y++) mask.fill(1, y * w + x0, y * w + x1 + 1);
    return withBounds(w, h, mask);
}

/** 칸 표시(1 = 선택)로 선택 만들기 — 마술봉·선택 회전(PR-G). 빈 표시면 null */
export function maskSelection(w: number, h: number, mask: Uint8Array): Selection | null {
    return withBounds(w, h, mask);
}

/** 선택 반전(PR-F) — 선택 안 된 칸만 선택(선택이 없으면 전체). 다 선택돼 있으면 null */
export function invertSelection(sel: Selection | null, w: number, h: number): Selection | null {
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = sel && sel.w === w && sel.h === h ? (sel.mask[i] ? 0 : 1) : 1;
    return withBounds(w, h, mask);
}

export const fullSelection = (w: number, h: number) => rectSelection({ x: 0, y: 0 }, { x: w - 1, y: h - 1 }, w, h);

/** 올가미: 그린 선이 감싼 칸(칸 가운데가 안쪽, 짝홀 규칙) + 선이 지나간 칸 */
export function polygonSelection(points: Point[], w: number, h: number): Selection | null {
    if (points.length < 3) return null;
    const mask = new Uint8Array(w * h);
    const n = points.length;
    for (let y = 0; y < h; y++) {
        const cy = y + 0.5;
        const xs: number[] = [];
        for (let i = 0; i < n; i++) {
            const a = points[i], b = points[(i + 1) % n];
            const ay = a.y + 0.5, by = b.y + 0.5;
            if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) {
                xs.push((a.x + 0.5) + (cy - ay) / (by - ay) * (b.x - a.x));
            }
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
            const from = Math.max(0, Math.ceil(xs[k] - 0.5)), to = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
            for (let x = from; x <= to; x++) mask[y * w + x] = 1;
        }
    }
    for (let i = 0; i < n; i++) {
        const a = points[i], b = points[(i + 1) % n];
        for (const p of getBresenhamPoints(a.x, a.y, b.x, b.y)) {
            if (p.x >= 0 && p.y >= 0 && p.x < w && p.y < h) mask[p.y * w + p.x] = 1;
        }
    }
    return withBounds(w, h, mask);
}

/** (dx, dy)만큼 옮긴 선택(캔버스 밖은 잘림) */
export function shiftSelection(sel: Selection, dx: number, dy: number): Selection | null {
    const { w, h } = sel;
    const mask = new Uint8Array(w * h);
    for (let y = sel.bounds.y0; y <= sel.bounds.y1; y++) for (let x = sel.bounds.x0; x <= sel.bounds.x1; x++) {
        if (!sel.mask[y * w + x]) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) mask[ny * w + nx] = 1;
    }
    return withBounds(w, h, mask);
}

export const inSelection = (sel: Selection, x: number, y: number) =>
    x >= 0 && y >= 0 && x < sel.w && y < sel.h && sel.mask[y * sel.w + x] === 1;

/** 줄마다 이어진 구간을 사각형으로 — 그리기를 선택 안으로 제한(ctx.clip)할 때 씀 */
export function selectionPath2D(sel: Selection): Path2D {
    const p = new Path2D();
    const { w } = sel;
    for (let y = sel.bounds.y0; y <= sel.bounds.y1; y++) {
        let x = sel.bounds.x0;
        while (x <= sel.bounds.x1) {
            if (!sel.mask[y * w + x]) { x++; continue; }
            const s = x;
            while (x <= sel.bounds.x1 && sel.mask[y * w + x]) x++;
            p.rect(s, y, x - s, 1);
        }
    }
    return p;
}

/** 선택 테두리(칸 경계) SVG 경로 — 같은 줄의 이어진 경계는 한 선으로 합침 */
export function selectionOutline(sel: Selection): string {
    const { w, h, mask } = sel;
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
    const segs: string[] = [];
    const { x0, y0, x1, y1 } = sel.bounds;
    // 가로 경계(위·아래)
    for (let y = y0; y <= y1 + 1; y++) {
        let run = -1;
        for (let x = x0; x <= x1 + 1; x++) {
            const edge = x <= x1 && on(x, y) !== on(x, y - 1);
            if (edge && run < 0) run = x;
            if (!edge && run >= 0) { segs.push(`M${run} ${y}H${x}`); run = -1; }
        }
    }
    // 세로 경계(왼쪽·오른쪽)
    for (let x = x0; x <= x1 + 1; x++) {
        let run = -1;
        for (let y = y0; y <= y1 + 1; y++) {
            const edge = y <= y1 && on(x, y) !== on(x - 1, y);
            if (edge && run < 0) run = y;
            if (!edge && run >= 0) { segs.push(`M${x} ${run}V${y}`); run = -1; }
        }
    }
    return segs.join('');
}

/** 선택 안 칸만 담은 조각(선택 경계 크기) */
export function extractSelection(src: CanvasRenderingContext2D, sel: Selection) {
    const { x0, y0, x1, y1 } = sel.bounds;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const img = src.getImageData(x0, y0, bw, bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        if (!sel.mask[(y + y0) * sel.w + (x + x0)]) img.data[(y * bw + x) * 4 + 3] = 0;
    }
    const c = document.createElement('canvas');
    c.width = bw;
    c.height = bh;
    c.getContext('2d')!.putImageData(img, 0, 0);
    return { canvas: c, x: x0, y: y0 };
}

/** 선택 안 칸 지우기 */
export function clearSelection(ctx: CanvasRenderingContext2D, sel: Selection) {
    ctx.save();
    ctx.clip(selectionPath2D(sel));
    ctx.clearRect(0, 0, sel.w, sel.h);
    ctx.restore();
}

/** 그리드 스냅: 시작은 격자선으로 내림, 끝은 다음 격자선 바로 앞 칸으로 */
export function snapStart(v: number, g: number) { return Math.floor(v / g) * g; }
export function snapEnd(v: number, g: number) { return Math.floor(v / g) * g + g - 1; }
