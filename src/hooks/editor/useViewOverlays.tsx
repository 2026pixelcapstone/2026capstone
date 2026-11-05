import { useState } from "react";

/** 보기 메뉴의 화면 보조 켜기·끄기(그림 데이터와 무관) — 픽셀 카운터·비율 가이드·미리보기 창 */
export function useViewOverlays() {
    const [pixelCounter, setPixelCounter] = useState(true);
    const [ratioGuide, setRatioGuide] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    return { pixelCounter, setPixelCounter, ratioGuide, setRatioGuide, previewOpen, setPreviewOpen };
}
