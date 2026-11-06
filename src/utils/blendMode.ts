import type { BlendMode } from '../type/editor';

/**
 * 레이어 혼합 모드 → 캔버스 합성 방식(PR-F). 전엔 고를 수만 있고 화면·내보내기 어디에도 안 쓰였음.
 * 화면(EditorCanvas)은 같은 이름의 CSS mix-blend-mode, 합성(내보내기·병합·썸네일)은 globalCompositeOperation — 둘 다 W3C 같은 식이라 결과가 같음.
 * .ppit 합성(lib/ppit.ts compositeFrame)도 같은 표를 씀.
 */
const OPS: Record<BlendMode, GlobalCompositeOperation> = {
    NORMAL: 'source-over',
    MULTIPLY: 'multiply',
    SCREEN: 'screen',
    OVERLAY: 'overlay',
    DARKEN: 'darken',
    LIGHTEN: 'lighten',
};

export function blendOp(mode: string | undefined | null): GlobalCompositeOperation {
    return OPS[(mode ?? 'NORMAL') as BlendMode] ?? 'source-over';
}

/** CSS mix-blend-mode 값 */
export function blendCss(mode: string | undefined | null): string {
    const op = blendOp(mode);
    return op === 'source-over' ? 'normal' : op;
}

/**
 * 지금 화면에 보이는 프레임을 레이어 캐시로 합성(투명도·혼합 모드 반영) — PNG 내보내기·저장 썸네일용.
 * stage.toDataURL은 레이어 캔버스를 그냥 겹쳐서 혼합 모드가 빠짐. 그림이 있는데 캐시가 없는 레이어가 있으면 null(부르는 쪽이 stage로 대신).
 */
export function compositeVisibleFrame(
    layers: { id: string; isVisible: boolean; opacity: number; blendMode: string; layerOrder: number; pixelData: string }[],
    frameId: string, width: number, height: number,
    peek: (cacheKey: string) => HTMLCanvasElement | null,
    cacheKey: (frameId: string, layerId: string) => string,
): HTMLCanvasElement | null {
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    for (const l of [...layers].sort((a, b) => a.layerOrder - b.layerOrder)) {
        if (!l.isVisible || l.opacity <= 0) continue;
        const c = peek(cacheKey(frameId, l.id));
        if (!c) { if (l.pixelData) return null; continue; }
        ctx.globalAlpha = l.opacity / 100;
        ctx.globalCompositeOperation = blendOp(l.blendMode);
        ctx.drawImage(c, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return out;
}
