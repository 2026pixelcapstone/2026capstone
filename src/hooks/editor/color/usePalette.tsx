import { PALETTE_COLORS } from "../../../constants/editor/editor";
import { toast } from "../../../store/toastStore";
import { SetStateAction, useState } from "react";

interface UsePalette{
    setFgColor: React.Dispatch<SetStateAction<string>>;
    setHexInput: React.Dispatch<SetStateAction<string>>;
}

export function usePalette({
    setFgColor,
    setHexInput,
}: UsePalette){
    // 팔레트를 고정 상수 → 상태로: AI 추천/사용자가 색을 추가할 수 있게 (세션 내, 저장 연동은 후속)
    const [paletteColors, setPaletteColors] = useState<string[]>(PALETTE_COLORS);

    // 팔레트 컬러 칩을 클릭했을 때 색상을 반영하는 함수
    const selectPaletteColor = (color: string) => {
        setFgColor(color);    // 1. 실제로 그려질 메인 전경색 변경
        setHexInput(color);   // 2. 눈에 보이는 HEX 텍스트 입력창 글자도 동기화
    };

    // 추천 색 세트를 팔레트에 추가(중복 제외, 세션 내)
    const addColorsToPalette = (colors: string[]) => {
        setPaletteColors((prev) => {
        const seen = new Set(prev.map((c) => c.toUpperCase()));
        const added = colors.filter((c) => {
            const key = c.toUpperCase();
            if (seen.has(key)) return false;
            seen.add(key); // 응답 내 중복 색도 한 번만 추가
            return true;
        });
        return added.length ? [...prev, ...added] : prev;
        });
        toast.success('팔레트에 추가했습니다.');
    };
    return{paletteColors, setPaletteColors, selectPaletteColor, addColorsToPalette };
}