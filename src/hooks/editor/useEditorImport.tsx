import { parsePpit } from "../../lib/ppit";
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
        
        replaceProject(cd, title);
    }, [replaceProject]);

    return{ loadPpitText }
}