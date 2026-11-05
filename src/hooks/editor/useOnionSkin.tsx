import { useEffect, useState } from "react";
import { FrameData } from "../../type/editor";
import { composite, loadPixelData } from "../../utils/pixelOps";

interface UseOnionSkin {
    enabled: boolean;
    frames: FrameData[];
    activeFrameId: string | null;
    width: number;
    height: number;
}

const PREV_TINT = '#ef4444';   // 앞 프레임 = 빨강
const NEXT_TINT = '#22c55e';   // 뒤 프레임 = 초록

/** 프레임 하나를 보이는 레이어대로 합친 뒤 한 색으로 물들임(그림 모양만 보이게) */
async function tintedFrame(frame: FrameData | undefined, w: number, h: number, tint: string) {
    if (!frame) return null;
    const layers = [...frame.layers].filter(l => l.isVisible).sort((a, b) => a.layerOrder - b.layerOrder);
    const canvases = await Promise.all(layers.map(l => loadPixelData(l.pixelData, w, h)));
    if (!canvases.some(Boolean)) return null;
    const c = composite(layers.map((l, i) => ({ canvas: canvases[i], opacity: l.opacity })), w, h);
    const ctx = c.getContext('2d');
    if (ctx) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }
    return c;
}

/**
 * 어니언 스킨(PR-B) — 지금 프레임 바로 앞(빨강)·뒤(초록) 프레임을 반투명하게 겹쳐 보기. 그림에는 안 들어감.
 * 프레임 상태가 바뀔 때만 다시 만듦(지금 프레임을 그리는 중에는 앞뒤 프레임이 안 바뀌므로 다시 만들 필요 없음).
 */
export function useOnionSkin({ enabled, frames, activeFrameId, width, height }: UseOnionSkin) {
    const [skins, setSkins] = useState<{ prev: HTMLCanvasElement | null; next: HTMLCanvasElement | null }>({ prev: null, next: null });

    // 앞·뒤 프레임 객체를 의존성으로 — 상태는 불변 갱신이라 지금 프레임만 바뀌면 앞뒤 프레임은 같은 객체(획마다 다시 합성하지 않음, CodeRabbit #129)
    const idx = frames.findIndex(f => f.id === activeFrameId);
    const prevFrame = idx > 0 ? frames[idx - 1] : undefined;
    const nextFrame = idx >= 0 && idx < frames.length - 1 ? frames[idx + 1] : undefined;

    useEffect(() => {
        if (!enabled) { setSkins({ prev: null, next: null }); return; }
        let cancelled = false;
        Promise.all([
            tintedFrame(prevFrame, width, height, PREV_TINT),
            tintedFrame(nextFrame, width, height, NEXT_TINT),
        ]).then(([prev, next]) => { if (!cancelled) setSkins({ prev, next }); })
          .catch(() => { if (!cancelled) setSkins({ prev: null, next: null }); });
        return () => { cancelled = true; };
    }, [enabled, prevFrame, nextFrame, width, height]);

    return skins;
}
