import React, { useEffect, useState } from "react";
import { nearestPaletteColor } from "../../utils/pixelOps";
import { toast } from "../../store/toastStore";

interface UsePaletteLock {
    fgColor: string;
    setFgColor: React.Dispatch<React.SetStateAction<string>>;
    paletteColors: string[];
}

/**
 * 팔레트 잠금(PR-B) — 켜면 그리는 색(전경색)이 항상 지금 팔레트 안의 색.
 * 색 고르기·스포이드로 팔레트 밖 색이 들어오면 가장 가까운 팔레트 색으로 바꿈 → 새로 그리는 칸은 팔레트 밖 색이 생기지 않음.
 * 이미 칠한 칸은 이미지 > 팔레트로 맞추기로 정리. (커뮤니티 팔레트로 연습하는 Lospec 방식)
 */
export function usePaletteLock({ fgColor, setFgColor, paletteColors }: UsePaletteLock) {
    const [paletteLock, setPaletteLock] = useState(false);

    useEffect(() => {
        if (!paletteLock || paletteColors.length === 0) return;
        const inPalette = paletteColors.some(c => c.toLowerCase() === fgColor.toLowerCase());
        if (inPalette) return;
        const near = nearestPaletteColor(fgColor, paletteColors);
        setFgColor(near);
        toast.info(`팔레트 잠금: ${fgColor} → 가장 가까운 팔레트 색 ${near}`);
    }, [paletteLock, fgColor, paletteColors, setFgColor]);

    return { paletteLock, setPaletteLock };
}
