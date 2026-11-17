import React, { useEffect, useRef } from "react";
import { EditorToolId } from "../../type/editor";

interface UseEditorShortcuts {
    activeTool: EditorToolId;
    setActiveTool: React.Dispatch<React.SetStateAction<EditorToolId>>;
    setPixelSize: React.Dispatch<React.SetStateAction<number>>;
    handleSwapColors: () => void;
}

/**
 * 한 글자 도구 단축키(도구바 라벨과 같게) — 구현된 도구만.
 * 물리 키(e.code) 기준: 한글 자판 상태면 e.key가 'ㅔ'처럼 들어와 글자로는 못 맞춤(CodeRabbit #128).
 */
const TOOL_KEYS: Record<string, EditorToolId> = {
    KeyP: 'pencil',
    KeyE: 'eraser',
    KeyG: 'fill',
    KeyI: 'eyedrop',
    KeyL: 'line',
    KeyR: 'rect',
    KeyO: 'ellipse',
    KeyH: 'pan',
    KeyM: 'marquee',
    KeyQ: 'lasso',
    KeyV: 'move',
    KeyW: 'wand',    // 마술봉(PR-G)
    KeyU: 'shade',   // 명암 펜(PR-G)
};

export const MIN_PIXEL_SIZE = 1;
export const MAX_PIXEL_SIZE = 20;   // 옵션 바 슬라이더와 같은 범위

// 글자를 칠 수 없는 입력(체크박스·슬라이더 등) — 여기에 포커스가 남아 있어도 단축키는 동작해야 함
const NON_TEXT_INPUT = ['checkbox', 'radio', 'range', 'button', 'color', 'submit', 'reset', 'file'];

/** 글자를 치는 중이면(텍스트 입력칸·텍스트 영역·선택 상자·편집 가능 요소) 단축키를 쓰지 않음 */
function isTyping(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT') return !NON_TEXT_INPUT.includes((el as HTMLInputElement).type);
    return tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** 버튼 내부 아이콘에 포커스가 있더라도 Space의 기본 버튼 활성화를 보존합니다. */
function isButton(target: EventTarget | null) {
    return target instanceof Element && target.closest('button, input[type="button"], input[type="submit"], input[type="reset"]') !== null;
}

/**
 * 에디터 도구 단축키(PR-A). Ctrl 조합(저장·되돌리기)은 EditorPage 기존 처리 그대로.
 * - Esc: 현재 요소의 포커스 해제 (개별 컴포넌트의 취소 처리가 우선)
 * - P E G I L R O H: 도구 바꾸기 / [ ]: 붓 크기 / X: 전경·배경색 바꾸기
 * - 스페이스를 누르는 동안 손 도구, Alt를 누르는 동안 스포이드(떼면 원래 도구로) — 포토샵·Aseprite와 같은 방식
 */
export function useEditorShortcuts({ activeTool, setActiveTool, setPixelSize, handleSwapColors }: UseEditorShortcuts) {
    const temp = useRef<{ key: 'space' | 'alt'; prev: EditorToolId } | null>(null);
    const toolRef = useRef(activeTool);
    useEffect(() => { toolRef.current = activeTool; }, [activeTool]);

    useEffect(() => {
        const restore = () => {
            if (!temp.current) return;
            setActiveTool(temp.current.prev);
            temp.current = null;
        };

        const onKeyDown = (e: KeyboardEvent) => {
            // 입력창에서도 포커스를 풀 수 있도록 isTyping 검사보다 먼저 처리합니다.
            // 조합 입력 취소 및 개별 컴포넌트가 처리한 Escape는 건드리지 않습니다.
            if (e.key === 'Escape') {
                if (e.isComposing || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
                const focused = document.activeElement;
                if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
                return;
            }
            if (isTyping(e.target)) return;
            if (e.ctrlKey || e.metaKey) return;

            if (e.code === 'Space') {
                if (isButton(e.target)) return;
                e.preventDefault();   // 캔버스에서 Space 이동 중 페이지 스크롤 방지
                if (!e.repeat && !temp.current && toolRef.current !== 'pan') {
                    temp.current = { key: 'space', prev: toolRef.current };
                    setActiveTool('pan');
                }
                return;
            }
            if (e.key === 'Alt') {
                e.preventDefault();   // 브라우저 메뉴 막대로 포커스가 가지 않게
                if (!e.repeat && !temp.current && toolRef.current !== 'eyedrop') {
                    temp.current = { key: 'alt', prev: toolRef.current };
                    setActiveTool('eyedrop');
                }
                return;
            }
            if (e.altKey) return;
            const code = e.code;
            const isBracket = code === 'BracketLeft' || code === 'BracketRight';
            if (e.repeat && !isBracket) return;   // 붓 크기만 누르고 있으면 계속 바뀜

            if (isBracket) {
                e.preventDefault();
                const d = code === 'BracketRight' ? 1 : -1;
                setPixelSize(s => Math.min(MAX_PIXEL_SIZE, Math.max(MIN_PIXEL_SIZE, s + d)));
                return;
            }
            if (code === 'KeyX') {
                e.preventDefault();
                handleSwapColors();
                return;
            }
            const tool = TOOL_KEYS[code];
            if (tool) {
                e.preventDefault();
                temp.current = null;   // 직접 고른 도구가 우선
                setActiveTool(tool);
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                if (!isTyping(e.target) && !isButton(e.target)) e.preventDefault();
                // Space 이동 중 포커스가 버튼으로 옮겨져도 임시 도구는 복구합니다.
                if (temp.current?.key === 'space') restore();
            } else if (e.key === 'Alt') {
                e.preventDefault();   // 윈도우에서 Alt만 눌렀다 떼면 브라우저 메뉴로 포커스가 감
                if (temp.current?.key === 'alt') restore();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', restore);   // 누른 채 다른 창으로 가면 keyup이 안 옴
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', restore);
        };
    }, [setActiveTool, setPixelSize, handleSwapColors]);
}
