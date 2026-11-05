/**
 * 레이어 그림 변환 공용 계산(PR-B) — 반전·회전·색 조정·팔레트로 맞추기·외곽선·색 바꾸기·합치기.
 * 입력·출력은 캔버스(레이어 크기 그대로, 회전만 가로세로가 바뀜). 상태 반영·되돌리기는 useImageOps가 함.
 */

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) ctx.imageSmoothingEnabled = false;
    return c;
}

function ctx2d(c: HTMLCanvasElement) {
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('캔버스를 만들지 못했어요.');
    ctx.imageSmoothingEnabled = false;
    return ctx;
}

// ── 반전·회전 ─────────────────────────────────────────

export type GeoOp = 'flipH' | 'flipV' | 'rot90cw' | 'rot90ccw' | 'rot180';

/** 회전 후 캔버스 크기 */
export function geoSize(op: GeoOp, w: number, h: number) {
    return op === 'rot90cw' || op === 'rot90ccw' ? { w: h, h: w } : { w, h };
}

/** 칸 단위로 정확히 옮김(보간 없음) */
export function applyGeo(src: HTMLCanvasElement, op: GeoOp): HTMLCanvasElement {
    const w = src.width, h = src.height;
    const { w: ow, h: oh } = geoSize(op, w, h);
    const s = ctx2d(src).getImageData(0, 0, w, h);
    const out = makeCanvas(ow, oh);
    const octx = ctx2d(out);
    const d = octx.createImageData(ow, oh);
    const s32 = new Uint32Array(s.data.buffer);
    const d32 = new Uint32Array(d.data.buffer);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let nx: number, ny: number;
            switch (op) {
                case 'flipH': nx = w - 1 - x; ny = y; break;
                case 'flipV': nx = x; ny = h - 1 - y; break;
                case 'rot90cw': nx = h - 1 - y; ny = x; break;
                case 'rot90ccw': nx = y; ny = w - 1 - x; break;
                default: nx = w - 1 - x; ny = h - 1 - y; break;   // rot180
            }
            d32[ny * ow + nx] = s32[y * w + x];
        }
    }
    octx.putImageData(d, 0, 0);
    return out;
}

// ── 색 계산 ───────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgbToHex(r: number, g: number, b: number) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** sRGB → OKLab(사람 눈 기준 색 거리 — '가장 가까운 팔레트 색' 계산용) */
function srgbToLinear(c: number) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function rgbToOklab(r8: number, g8: number, b8: number): [number, number, number] {
    const r = srgbToLinear(r8), g = srgbToLinear(g8), b = srgbToLinear(b8);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
}

/** 팔레트에서 가장 가까운 색(OKLab 거리) */
export function nearestPaletteColor(hex: string, palette: string[]): string {
    if (!palette.length) return hex;
    const [r, g, b] = hexToRgb(hex);
    const [L, A, B] = rgbToOklab(r, g, b);
    let best = palette[0], bestD = Infinity;
    for (const p of palette) {
        const [pr, pg, pb] = hexToRgb(p);
        const [l2, a2, b2] = rgbToOklab(pr, pg, pb);
        const d = (L - l2) ** 2 + (A - a2) ** 2 + (B - b2) ** 2;
        if (d < bestD) { bestD = d; best = p; }
    }
    return best;
}

// ── 칸별 색 변환(투명 칸은 건드리지 않음) ──────────────

function mapPixels(src: HTMLCanvasElement, fn: (r: number, g: number, b: number) => [number, number, number]): HTMLCanvasElement {
    const w = src.width, h = src.height;
    const img = ctx2d(src).getImageData(0, 0, w, h);
    const d = img.data;
    const cache = new Map<number, [number, number, number]>();   // 픽셀아트는 색 수가 적음 → 색마다 한 번만 계산
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        let c = cache.get(key);
        if (!c) { c = fn(d[i], d[i + 1], d[i + 2]); cache.set(key, c); }
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    const out = makeCanvas(w, h);
    ctx2d(out).putImageData(img, 0, 0);
    return out;
}

export interface HsbAdjust { hue: number; saturation: number; brightness: number }   // 색조 −180~180°, 채도·밝기 −100~100

export function adjustHsb(src: HTMLCanvasElement, a: HsbAdjust): HTMLCanvasElement {
    return mapPixels(src, (r, g, b) => {
        let [h, s, v] = rgbToHsv(r, g, b);
        h = (h + a.hue + 360) % 360;
        s = Math.max(0, Math.min(1, a.saturation >= 0 ? s + (1 - s) * a.saturation / 100 : s * (1 + a.saturation / 100)));
        v = Math.max(0, Math.min(1, a.brightness >= 0 ? v + (1 - v) * a.brightness / 100 : v * (1 + a.brightness / 100)));
        return hsvToRgb(h, s, v);
    });
}

export const invertColors = (src: HTMLCanvasElement) => mapPixels(src, (r, g, b) => [255 - r, 255 - g, 255 - b]);

export const grayscale = (src: HTMLCanvasElement) => mapPixels(src, (r, g, b) => {
    const v = 0.2126 * r + 0.7152 * g + 0.0722 * b;   // 미리보기 '명도'와 같은 가중치
    return [v, v, v];
});

export function snapToPalette(src: HTMLCanvasElement, palette: string[]): HTMLCanvasElement {
    return mapPixels(src, (r, g, b) => hexToRgb(nearestPaletteColor(rgbToHex(r, g, b), palette)));
}

/** 한 색을 다른 색으로(정확히 같은 색만, 투명도 유지) */
export function replaceColor(src: HTMLCanvasElement, from: string, to: string): HTMLCanvasElement {
    const f = hexToRgb(from), t = hexToRgb(to);
    return mapPixels(src, (r, g, b) => (r === f[0] && g === f[1] && b === f[2] ? t : [r, g, b]));
}

/** 그림에 쓰인 불투명 색 목록(많이 쓴 순) */
export function usedColors(src: HTMLCanvasElement, limit = 64): string[] {
    const d = ctx2d(src).getImageData(0, 0, src.width, src.height).data;
    const count = new Map<string, number>();
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const k = rgbToHex(d[i], d[i + 1], d[i + 2]);
        count.set(k, (count.get(k) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(e => e[0]);
}

// ── 외곽선 ───────────────────────────────────────────

export interface OutlineOptions {
    color: string;
    placement: 'outside' | 'inside';   // 바깥: 그림 둘레 빈 칸에 / 안쪽: 그림 가장자리 칸을 덮어씀
    diagonal: boolean;                 // 대각선 이웃까지(8방향) — 끄면 4방향(픽셀아트에서 흔히 쓰는 얇은 외곽선)
}

export function addOutline(src: HTMLCanvasElement, o: OutlineOptions): HTMLCanvasElement {
    const w = src.width, h = src.height;
    const img = ctx2d(src).getImageData(0, 0, w, h);
    const d = img.data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const nb = o.diagonal
        ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
        : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [cr, cg, cb] = hexToRgb(o.color);
    const marks: number[] = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const me = solid(x, y);
            if (o.placement === 'outside' && !me && nb.some(([dx, dy]) => solid(x + dx, y + dy))) marks.push(y * w + x);
            if (o.placement === 'inside' && me && nb.some(([dx, dy]) => !solid(x + dx, y + dy))) marks.push(y * w + x);
        }
    }
    for (const i of marks) { d[i * 4] = cr; d[i * 4 + 1] = cg; d[i * 4 + 2] = cb; d[i * 4 + 3] = 255; }
    const out = makeCanvas(w, h);
    ctx2d(out).putImageData(img, 0, 0);
    return out;
}

// ── 합치기 ───────────────────────────────────────────

/**
 * 레이어 여러 장을 아래→위 순서로 합침. 화면(EditorCanvas)이 레이어 투명도만 반영하고 혼합 모드는 안 쓰므로 똑같이 맞춤
 * (보이는 것과 합친 결과가 같아야 함).
 */
export function composite(layers: { canvas: HTMLCanvasElement | null; opacity: number }[], w: number, h: number): HTMLCanvasElement {
    const out = makeCanvas(w, h);
    const ctx = ctx2d(out);
    for (const l of layers) {
        if (!l.canvas || l.opacity <= 0) continue;
        ctx.globalAlpha = l.opacity / 100;
        ctx.drawImage(l.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
    return out;
}

/** 칠한 칸이 없으면 ''(저장 형식과 같은 규칙 — editorUtils.getLayerImageData) */
export function canvasToPixelData(c: HTMLCanvasElement): string {
    const d = ctx2d(c).getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return c.toDataURL('image/png');
    return '';
}

/** 저장된 레이어 그림(dataURL·주소) → 캔버스. 빈 레이어는 null */
export function loadPixelData(pixelData: string, w: number, h: number): Promise<HTMLCanvasElement | null> {
    if (!pixelData || !pixelData.trim()) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = makeCanvas(w, h);
            ctx2d(c).drawImage(img, 0, 0);
            resolve(c);
        };
        img.onerror = () => reject(new Error('레이어 그림을 읽지 못했어요.'));
        img.src = pixelData;
    });
}
