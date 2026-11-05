import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * 손 도구(화면 이동) — 캔버스 래퍼를 CSS로 옮김(그림 데이터와 무관, 되돌리기 기록 없음).
 * 끄는 동안은 window에서 마우스를 따라감(캔버스 밖으로 나가도 끊기지 않게).
 */
export function useCanvasPan() {
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [panning, setPanning] = useState(false);
    const panRef = useRef(pan);
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => { panRef.current = pan; }, [pan]);
    useEffect(() => () => cleanupRef.current?.(), []);   // 끄는 중에 에디터를 나가도 리스너가 남지 않게

    const startPan = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        cleanupRef.current?.();
        const sx = e.clientX, sy = e.clientY;
        const { x: ox, y: oy } = panRef.current;
        const move = (ev: MouseEvent) => setPan({ x: ox + ev.clientX - sx, y: oy + ev.clientY - sy });
        const up = () => cleanupRef.current?.();
        cleanupRef.current = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            cleanupRef.current = null;
            setPanning(false);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        setPanning(true);
    }, []);

    const resetPan = useCallback(() => setPan({ x: 0, y: 0 }), []);

    return { pan, panning, startPan, resetPan };
}
