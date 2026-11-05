import { useEffect, useRef } from "react";

interface OnionSkinCanvasProps {
    prev: HTMLCanvasElement | null;
    next: HTMLCanvasElement | null;
    width: number;
    height: number;
}

/**
 * 어니언 스킨 표시(PR-B) — Konva Stage 밖의 DOM 캔버스.
 * Stage 안에 두면 stage.toDataURL()(PNG 저장·프로젝트 저장 썸네일)에 앞뒤 프레임 잔상이 같이 찍힘(CodeRabbit #129).
 * 캔버스 래퍼 안에서 Stage보다 아래(z-index)에 깔고, 확대는 래퍼의 CSS scale을 그대로 따름.
 */
export function OnionSkinCanvas({ prev, next, width, height }: OnionSkinCanvasProps) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = ref.current;
        const ctx = c?.getContext('2d');
        if (!c || !ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.imageSmoothingEnabled = false;
        if (prev) ctx.drawImage(prev, 0, 0);
        if (next) ctx.drawImage(next, 0, 0);
    }, [prev, next, width, height]);

    if (!prev && !next) return null;
    return (
        <canvas ref={ref} width={width} height={height} aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%', opacity: 0.35, imageRendering: 'pixelated', zIndex: 0 }} />
    );
}
