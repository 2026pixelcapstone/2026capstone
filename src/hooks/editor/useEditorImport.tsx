import { MIN_DURATION_30FPS } from "../../constants/editor/editor";
import { parsePpit, PPIT_DEFAULT_FPS } from "../../lib/ppit";
import { CanvasState } from "../../type/editor";
import { ppitToCanvasData } from "../../utils/ppitConvert";
import { useCallback } from "react";

interface UseEditorImport{
    replaceProject: (cd: CanvasState, title: string) => void
}

export function useEditorImport({
    replaceProject
}: UseEditorImport){
    // .ppit 텍스트를 에디터 상태로 로드 (파일/URL 공통)
    const loadPpitText = useCallback((text: string, title: string) => {
        const ppit = parsePpit(text);
        const cd = ppitToCanvasData(ppit);
        
    // ppit 파일에 저장된 fps를 가져오거나, 없으면 기본값 사용
    const importedFps = ppit.canvas?.fps ?? PPIT_DEFAULT_FPS;

    // duration 변환 공식 적용
    const safeDuration = Math.round(1000 / Math.max(MIN_DURATION_30FPS, importedFps));

    // 변환된 duration을 모든 프레임에 일괄 적용하여 저장
    replaceProject({
        ...cd,
        frames: cd.frames.map(f => ({ ...f, duration: safeDuration }))
    }, title);
    }, [replaceProject]);

    return{ loadPpitText }
}