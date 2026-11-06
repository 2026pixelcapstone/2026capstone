import { Point } from "../type/editor";

/**
 * 픽셀 찍기 공용 계산 — 연필·지우개·직선·도형·채우기가 함께 씀.
 * 옵션: 붓 크기, 투명 픽셀 잠금(칠한 칸 위에만), 체크무늬(디더), 좌우·상하 대칭.
 * 모두 레이어 캐시 캔버스(ctx)에 직접 그림 — 기록(되돌리기)은 마우스를 뗄 때 commitLayerChanges가 남김.
 */
export interface BrushOptions {
    size: number;
    color: string | null;      // null = 지우기
    alphaLock?: boolean;       // 투명 픽셀 잠금: 이미 칠한 칸에만 칠함(지우개에는 적용 안 함)
    dither?: boolean;          // 체크무늬: (x+y)가 짝수인 칸만
    symmetryX?: boolean;       // 좌우 대칭(세로 가운데 축)
    symmetryY?: boolean;       // 상하 대칭(가로 가운데 축)
    wrap?: boolean;            // 타일 모드(PR-G): 가장자리를 넘으면 반대편에 이어 칠함
}

/** 대칭 옵션에 따라 같은 붓 사각형의 왼쪽 위 좌표들(원래 + 거울) */
function mirroredOrigins(x0: number, y0: number, size: number, w: number, h: number, o: BrushOptions): Point[] {
    const list: Point[] = [{ x: x0, y: y0 }];
    const mx = w - x0 - size;
    const my = h - y0 - size;
    if (o.symmetryX) list.push({ x: mx, y: y0 });
    if (o.symmetryY) list.push({ x: x0, y: my });
    if (o.symmetryX && o.symmetryY) list.push({ x: mx, y: my });
    // 축 위에 있으면 같은 자리가 겹침 — 한 번만
    const seen = new Set<string>();
    return list.filter(p => { const k = `${p.x},${p.y}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function paintRect(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, o: BrushOptions) {
    paintBox(ctx, x, y, size, size, o);
}

/** w×h 상자 칠하기(투명 잠금·체크무늬 반영). 타일 모드면 넘친 부분을 반대편에도(PR-G) */
function paintBox(ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number, o: BrushOptions) {
    if (!o.wrap) { paintBoxOnce(ctx, x, y, bw, bh, o); return; }
    const { width: W, height: H } = ctx.canvas;
    for (const dy of [-H, 0, H]) for (const dx of [-W, 0, W]) {
        // 캔버스와 겹치는 사본만(겹치지 않으면 어차피 안 그려지지만 체크무늬 반복을 줄임)
        if (x + dx + bw <= 0 || x + dx >= W || y + dy + bh <= 0 || y + dy >= H) continue;
        paintBoxOnce(ctx, x + dx, y + dy, bw, bh, o);
    }
}

function paintBoxOnce(ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number, o: BrushOptions) {
    const erase = o.color === null;
    const lock = !!o.alphaLock && !erase;
    if (lock) ctx.globalCompositeOperation = 'source-atop';   // 기존 칸의 불투명도 안에서만 칠해짐
    if (!erase) ctx.fillStyle = o.color as string;
    if (!o.dither) {
        if (erase) ctx.clearRect(x, y, bw, bh);
        else ctx.fillRect(x, y, bw, bh);
    } else {
        for (let py = y; py < y + bh; py++) {
            for (let px = x; px < x + bw; px++) {
                if (((px + py) & 1) !== 0) continue;
                if (erase) ctx.clearRect(px, py, 1, 1);
                else ctx.fillRect(px, py, 1, 1);
            }
        }
    }
    if (lock) ctx.globalCompositeOperation = 'source-over';
}

/** 중심 (cx, cy)에 붓 한 번 찍기(대칭 포함) */
export function stampBrush(ctx: CanvasRenderingContext2D, cx: number, cy: number, o: BrushOptions) {
    const size = Math.max(1, o.size | 0);
    const offset = Math.floor((size - 1) / 2);
    const { width, height } = ctx.canvas;
    for (const p of mirroredOrigins(cx - offset, cy - offset, size, width, height, o)) {
        paintRect(ctx, p.x, p.y, size, o);
    }
}

/**
 * 가로 구간 [x0, x1] × y를 붓으로 한 번에 칠함 = 그 구간의 칸마다 붓을 찍은 것과 같은 결과(붓 사각형들의 합집합이 한 사각형).
 * 채움 도형 미리보기를 줄마다 한 번으로(512×512 채움도 줄 512번) — CodeRabbit #128.
 */
export function stampSpan(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, o: BrushOptions) {
    const size = Math.max(1, o.size | 0);
    const offset = Math.floor((size - 1) / 2);
    const { width, height } = ctx.canvas;
    const left = Math.min(x0, x1) - offset;
    const w = Math.abs(x1 - x0) + size;
    const top = y - offset;
    const list: Point[] = [{ x: left, y: top }];
    if (o.symmetryX) list.push({ x: width - left - w, y: top });
    if (o.symmetryY) list.push({ x: left, y: height - top - size });
    if (o.symmetryX && o.symmetryY) list.push({ x: width - left - w, y: height - top - size });
    const seen = new Set<string>();
    for (const p of list) {
        const k = `${p.x},${p.y}`;
        if (seen.has(k)) continue;
        seen.add(k);
        paintBox(ctx, p.x, p.y, w, size, o);
    }
}

/** 붓 한 번이 건드리는 모든 칸(대칭 포함) — 픽셀 퍼펙트가 원래 색을 저장·복원할 때 씀 */
export function brushCells(cx: number, cy: number, o: BrushOptions, w: number, h: number): Point[] {
    const size = Math.max(1, o.size | 0);
    const offset = Math.floor((size - 1) / 2);
    const cells: Point[] = [];
    for (const p of mirroredOrigins(cx - offset, cy - offset, size, w, h, o)) {
        for (let y = p.y; y < p.y + size; y++) for (let x = p.x; x < p.x + size; x++) {
            if (x >= 0 && y >= 0 && x < w && y < h) cells.push({ x, y });
        }
    }
    return cells;
}

// ── 도형 좌표 ─────────────────────────────────────────

/** Shift: 정사각형·정원(긴 변 기준, 끌던 방향 유지) */
export function constrainSquare(start: Point, end: Point): Point {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: start.x + (dx < 0 ? -d : d), y: start.y + (dy < 0 ? -d : d) };
}

export function rectPoints(a: Point, b: Point, filled: boolean): Point[] {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const pts: Point[] = [];
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            if (filled || y === y0 || y === y1 || x === x0 || x === x1) pts.push({ x, y });
        }
    }
    return pts;
}

/**
 * 사각형 안에 꼭 맞는 타원 — Zingl, "A Rasterizing Algorithm for Drawing Curves"(2012)의 plotEllipseRect.
 * 짝수 폭·높이도 대칭으로 나옴(픽셀아트 원에 흔히 쓰는 방식).
 */
export function ellipsePoints(p0: Point, p1: Point, filled: boolean): Point[] {
    let x0 = p0.x, y0 = p0.y, x1 = p1.x, y1 = p1.y;
    const out: Point[] = [];
    const put = (x: number, y: number) => out.push({ x, y });

    let a = Math.abs(x1 - x0);
    const b = Math.abs(y1 - y0);
    let b1 = b & 1;
    let dx = 4 * (1 - a) * b * b;
    let dy = 4 * (b1 + 1) * a * a;
    let err = dx + dy + b1 * a * a;
    if (x0 > x1) { x0 = x1; x1 += a; }
    if (y0 > y1) y0 = y1;
    y0 += (b + 1) >> 1;
    y1 = y0 - b1;
    a *= 8 * a;
    b1 = 8 * b * b;
    do {
        put(x1, y0); put(x0, y0); put(x0, y1); put(x1, y1);
        const e2 = 2 * err;
        if (e2 <= dy) { y0++; y1--; dy += a; err += dy; }
        if (e2 >= dx || 2 * err > dy) { x0++; x1--; dx += b1; err += dx; }
    } while (x0 <= x1);
    while (y0 - y1 <= b) {   // 납작한 타원의 양 끝
        put(x0 - 1, y0); put(x1 + 1, y0++);
        put(x0 - 1, y1); put(x1 + 1, y1--);
    }

    // 중복 제거 + 채움이면 줄마다 양 끝 사이를 채움
    const rows = new Map<number, { min: number; max: number }>();
    const seen = new Set<string>();
    const outline: Point[] = [];
    for (const p of out) {
        const k = `${p.x},${p.y}`;
        if (seen.has(k)) continue;
        seen.add(k);
        outline.push(p);
        const r = rows.get(p.y);
        if (!r) rows.set(p.y, { min: p.x, max: p.x });
        else { r.min = Math.min(r.min, p.x); r.max = Math.max(r.max, p.x); }
    }
    if (!filled) return outline;
    const pts: Point[] = [];
    rows.forEach((r, y) => { for (let x = r.min; x <= r.max; x++) pts.push({ x, y }); });
    return pts;
}

// ── 채우기 ───────────────────────────────────────────

function hexToAbgr(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/**
 * 같은 색으로 이어진 칸 채우기(4방향). 대칭이면 거울 자리에서도 한 번씩.
 * 투명 픽셀 잠금: 시작 칸이 투명이면 안 칠함. 체크무늬: 이어진 칸 중 (x+y) 짝수 칸만 칠함(나머지는 원래 색).
 * @returns 바뀐 칸이 있었는지
 */
/** 두 색(ABGR 32비트)이 허용 오차 안인지 — 채널별 차이가 tol 이하(0이면 완전히 같은 색만) */
function near(a: number, b: number, tol: number): boolean {
    if (a === b) return true;
    if (tol <= 0) return false;
    for (let s = 0; s < 32; s += 8) if (Math.abs(((a >>> s) & 255) - ((b >>> s) & 255)) > tol) return false;
    return true;
}

export interface RegionOptions {
    contiguous?: boolean;     // true(기본) = 이어진 칸만, false = 같은 색 전부
    tolerance?: number;       // 0~255, 채널별 허용 차이
    mask?: Uint8Array | null; // 이 안에서만
}

/**
 * (sx, sy) 칸과 같은(허용 오차 안) 색 영역 — 마술봉 선택과 채우기가 같이 씀(PR-G). 1 = 포함
 */
export function colorRegion(data32: Uint32Array, width: number, height: number, sx: number, sy: number, o: RegionOptions = {}): Uint8Array {
    const out = new Uint8Array(width * height);
    const start = sy * width + sx;
    if (o.mask && !o.mask[start]) return out;
    const target = data32[start];
    const tol = Math.max(0, Math.min(255, o.tolerance ?? 0));
    if (o.contiguous === false) {
        for (let i = 0; i < out.length; i++) if ((!o.mask || o.mask[i]) && near(data32[i], target, tol)) out[i] = 1;
        return out;
    }
    const queue = new Int32Array(width * height);
    let head = 0, tail = 0;
    queue[tail++] = start;
    out[start] = 1;
    while (head < tail) {
        const idx = queue[head++];
        const cx = idx % width;
        const push = (n: number) => {
            if (!out[n] && (!o.mask || o.mask[n]) && near(data32[n], target, tol)) { out[n] = 1; queue[tail++] = n; }
        };
        if (cx > 0) push(idx - 1);
        if (cx < width - 1) push(idx + 1);
        if (idx >= width) push(idx - width);
        if (idx + width < out.length) push(idx + width);
    }
    return out;
}

export function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string, o: Omit<BrushOptions, 'size' | 'color'> & { mask?: Uint8Array | null; contiguous?: boolean; tolerance?: number }): boolean {
    const { width, height } = ctx.canvas;
    const img = ctx.getImageData(0, 0, width, height);
    const data32 = new Uint32Array(img.data.buffer);
    const fill = hexToAbgr(color);
    const seeds: Point[] = [{ x: sx, y: sy }];
    if (o.symmetryX) seeds.push({ x: width - 1 - sx, y: sy });
    if (o.symmetryY) seeds.push({ x: sx, y: height - 1 - sy });
    if (o.symmetryX && o.symmetryY) seeds.push({ x: width - 1 - sx, y: height - 1 - sy });

    let changed = false;
    const done = new Uint8Array(width * height);
    for (const s of seeds) {
        const start = s.y * width + s.x;
        if (done[start]) continue;
        if (o.mask && !o.mask[start]) continue;   // 선택 밖에서 시작하면 안 칠함(PR-D)
        const target = data32[start];
        if (o.alphaLock && (target >>> 24) === 0) continue;
        if (target === fill && !o.dither && o.contiguous !== false) continue;
        // 이어진 칸만 / 같은 색 전부 + 허용 오차(PR-G) — 마술봉과 같은 영역 계산
        const region = colorRegion(data32, width, height, s.x, s.y, { contiguous: o.contiguous, tolerance: o.tolerance, mask: o.mask });
        for (let idx = 0; idx < region.length; idx++) {
            if (!region[idx] || done[idx]) continue;
            done[idx] = 1;
            if (o.alphaLock && (data32[idx] >>> 24) === 0) continue;
            const cx = idx % width, cy = (idx - cx) / width;
            if (!o.dither || ((cx + cy) & 1) === 0) {
                if (data32[idx] !== fill) { data32[idx] = fill; changed = true; }
            }
        }
    }
    if (changed) ctx.putImageData(img, 0, 0);
    return changed;
}

// ── 비율 가이드 ───────────────────────────────────────

/** 직선의 픽셀 비율 — 1:1·2:1·1:3처럼 정수 비면 '깔끔한 선'(계단 길이가 일정) */
export function lineRatio(a: Point, b: Point): { label: string; clean: boolean } {
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx === 0 && dy === 0) return { label: '점', clean: true };
    if (dy === 0) return { label: '수평', clean: true };
    if (dx === 0) return { label: '수직', clean: true };
    // 칸 수 기준(끝점 포함): 2:1 선은 가로 2칸마다 세로 1칸 → (dx+1):(dy+1)가 정수 비
    const w = dx + 1, h = dy + 1;
    if (w % h === 0) return { label: `${w / h}:1`, clean: true };
    if (h % w === 0) return { label: `1:${h / w}`, clean: true };
    const r = w > h ? (w / h).toFixed(1) + ':1' : '1:' + (h / w).toFixed(1);
    return { label: r, clean: false };
}

/** 비율 가이드 선 방향(시작점에서 뻗는 방향) — 수평·수직·1:1·2:1·1:2·3:1·1:3 × 4사분면 */
export const RATIO_GUIDE_DIRS: { dx: number; dy: number; label: string }[] = (() => {
    const base = [[1, 0, '수평'], [0, 1, '수직'], [1, 1, '1:1'], [2, 1, '2:1'], [1, 2, '1:2'], [3, 1, '3:1'], [1, 3, '1:3']] as const;
    const dirs: { dx: number; dy: number; label: string }[] = [];
    for (const [x, y, label] of base) {
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const d = { dx: x * sx, dy: y * sy, label };
            if (!dirs.some(e => e.dx === d.dx && e.dy === d.dy)) dirs.push(d);
        }
    }
    return dirs;
})();
