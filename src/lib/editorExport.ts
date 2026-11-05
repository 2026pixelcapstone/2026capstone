import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { CanvasState } from "../type/editor";
import { composite, loadPixelData, makeCanvas } from "../utils/pixelOps";

/**
 * 에디터 내보내기 공용(PR-C) — 프레임 합성·배율·스프라이트시트(+Aseprite 호환 JSON)·GIF·zip.
 * 그림 원본은 상태의 pixelData(캐시 아님) → 화면에 안 보이는 프레임도 정확.
 * 합성은 화면과 같이 레이어 투명도만 반영(useImageOps 병합과 같은 규칙).
 */

export const EXPORT_SCALES = [1, 2, 4, 8] as const;
export const MAX_EXPORT_SIDE = 8192;   // 브라우저 캔버스가 안전하게 다루는 한 변 길이

/** 프레임마다 보이는 레이어를 합친 그림(원래 크기) */
export async function renderFrames(state: CanvasState): Promise<HTMLCanvasElement[]> {
    const out: HTMLCanvasElement[] = [];
    for (const f of state.frames) {
        const layers = [...f.layers].filter(l => l.isVisible).sort((a, b) => a.layerOrder - b.layerOrder);
        const canvases = await Promise.all(layers.map(l => loadPixelData(l.pixelData, state.width, state.height)));
        out.push(composite(layers.map((l, i) => ({ canvas: canvases[i], opacity: l.opacity })), state.width, state.height));
    }
    return out;
}

/** 칸을 그대로 키움(흐림 없음) */
export function scaleCanvas(src: HTMLCanvasElement, s: number): HTMLCanvasElement {
    if (s === 1) return src;
    const c = makeCanvas(src.width * s, src.height * s);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
    return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요.'))), type));
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFileName = (title: string | null | undefined) =>
    (title || 'artwork').trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_') || 'artwork';

// ── GIF ─────────────────────────────────────────────

/** 프레임마다 속도(ms)를 지키는 GIF. 투명 칸은 투명색으로 */
export function encodeGif(frames: HTMLCanvasElement[], delays: number[]): Blob {
    const gif = GIFEncoder();
    frames.forEach((c, i) => {
        const { data } = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
        const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true });
        const index = applyPalette(data, palette, 'rgba4444');
        const ti = palette.findIndex(p => p[3] === 0);
        gif.writeFrame(index, c.width, c.height, {
            palette,
            delay: Math.max(20, delays[i] ?? 100),   // 20ms 미만은 브라우저가 100ms로 바꿔 재생함
            repeat: 0,
            ...(ti >= 0 ? { transparent: true, transparentIndex: ti } : {}),
        });
    });
    gif.finish();
    return new Blob([gif.bytesView()], { type: 'image/gif' });
}

// ── 스프라이트시트 ────────────────────────────────────

export type SheetLayout = 'row' | 'grid';

export interface SpriteSheet {
    canvas: HTMLCanvasElement;
    json: object;
}

/**
 * 프레임을 한 장에 배치 + Aseprite 'JSON Array' 형식 데이터.
 * 이 형식은 Phaser·Godot·Unity용 Aseprite 가져오기 도구들이 읽는 사실상 표준(frames[].frame·duration, meta.frameTags).
 */
export function buildSpriteSheet(state: CanvasState, frames: HTMLCanvasElement[], scale: number, layout: SheetLayout, imageName: string): SpriteSheet {
    const n = frames.length;
    const cols = layout === 'row' ? n : Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const fw = state.width * scale, fh = state.height * scale;
    const canvas = makeCanvas(cols * fw, rows * fh);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const list = frames.map((f, i) => {
        const x = (i % cols) * fw, y = Math.floor(i / cols) * fh;
        ctx.drawImage(f, x, y, fw, fh);
        return {
            filename: `${imageName} ${i}`,
            frame: { x, y, w: fw, h: fh },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: fw, h: fh },
            sourceSize: { w: fw, h: fh },
            duration: state.frames[i]?.duration ?? 100,
        };
    });
    const json = {
        frames: list,
        meta: {
            app: 'PixelPilot',
            version: '1.0',
            image: `${imageName}.png`,
            format: 'RGBA8888',
            size: { w: canvas.width, h: canvas.height },
            scale: String(scale),
            frameTags: (state.animationTags ?? []).map(t => ({ name: t.name, from: t.fromIndex, to: t.toIndex, direction: 'forward', color: t.color })),
        },
    };
    return { canvas, json };
}

// ── zip(압축 없이 묶기) ───────────────────────────────

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(data: Uint8Array) {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/**
 * 파일 여러 개를 zip 하나로(저장 방식 = 압축 없음). PNG·GIF는 이미 압축돼 있어 크기 차이가 거의 없고, 라이브러리 없이 됨.
 * 형식: PKWARE APPNOTE의 로컬 헤더 + 중앙 디렉터리 + 끝 레코드. 파일 이름은 UTF-8(플래그 비트 11).
 */
export async function makeZip(files: { name: string; data: Blob | string }[]): Promise<Blob> {
    const enc = new TextEncoder();
    const parts: BlobPart[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;
    for (const f of files) {
        const bytes = typeof f.data === 'string' ? enc.encode(f.data) : new Uint8Array(await f.data.arrayBuffer());
        const name = enc.encode(f.name);
        const crc = crc32(bytes);
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true);          // UTF-8 이름
        local.setUint16(8, 0, true);               // 저장(압축 없음)
        local.setUint32(14, crc, true);
        local.setUint32(18, bytes.length, true);
        local.setUint32(22, bytes.length, true);
        local.setUint16(26, name.length, true);
        parts.push(local.buffer, name, bytes);

        const cen = new DataView(new ArrayBuffer(46));
        cen.setUint32(0, 0x02014b50, true);
        cen.setUint16(4, 20, true);
        cen.setUint16(6, 20, true);
        cen.setUint16(8, 0x0800, true);
        cen.setUint32(16, crc, true);
        cen.setUint32(20, bytes.length, true);
        cen.setUint32(24, bytes.length, true);
        cen.setUint16(28, name.length, true);
        cen.setUint32(42, offset, true);
        const entry = new Uint8Array(46 + name.length);
        entry.set(new Uint8Array(cen.buffer), 0);
        entry.set(name, 46);
        central.push(entry);
        offset += 30 + name.length + bytes.length;
    }
    const cenSize = central.reduce((s, e) => s + e.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
