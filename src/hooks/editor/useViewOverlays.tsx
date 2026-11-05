import { useState } from "react";

/** 보기 메뉴의 화면 보조 켜기·끄기(그림 데이터와 무관) — 픽셀 카운터·비율 가이드·미리보기 창·어니언 스킨 */
export function useViewOverlays() {
    const [pixelCounter, setPixelCounter] = useState(true);
    const [ratioGuide, setRatioGuide] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [onionSkin, setOnionSkin] = useState(false);
    // 그리드 스냅(PR-D): 선택·도형·이동이 8·16·32칸 격자에 붙음
    const [gridSnap, setGridSnap] = useState(false);
    const [gridSize, setGridSize] = useState(16);
    // 미리보기 창을 어떤 모드로 열지(타일 미리보기 메뉴) — 바뀌면 창을 새로 염
    const [previewMode, setPreviewMode] = useState<'normal' | 'tile'>('normal');
    return { pixelCounter, setPixelCounter, ratioGuide, setRatioGuide, previewOpen, setPreviewOpen, onionSkin, setOnionSkin,
        gridSnap, setGridSnap, gridSize, setGridSize, previewMode, setPreviewMode };
}
