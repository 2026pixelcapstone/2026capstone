import { useState, useCallback } from "react";

export function useHistory<T>(initialState: T){
    // 데이터 무결성을 위해 let 대신 const를 씀
    const [state, setState] = useState<T>(initialState);
    const [undoStack, setUndoStack] = useState<T[]>([]);
    const [redoStack, setRedoStack] = useState<T[]>([]);

    // (new 작업이 들어왔을 때)새로운 상태로 업데이트
    const setWithHistory = useCallback((value: T | ((prev: T) => T )) => {
        const newState = value instanceof Function ? value(state) : value;
        setUndoStack((prev) => [...prev, state]); // 현재 상태를 Undo 스택에 저장
        setRedoStack([]); // 새로운 작업이 들어오면 Redo 스택은 초기화 
        setState(newState); // 다음 리렌더링 때 state를 newState로 바꿔줌
    }, [state]); // state가 바뀌면 최상위에 있는 useHistory를 리렌더링 함(최신 값 반영)

    // 뒤로가기
    const undo = useCallback(() => {
        if(undoStack.length === 0) return;

        const previous = undoStack[undoStack.length - 1]
        const newUndoStack = undoStack.slice(0, -1); // 마지막 아이템을 제외한 나머지만 복사

        setRedoStack((prev) => [state, ...prev]); // unshift 사용
        setUndoStack(newUndoStack); // UndoStatck 갱신
        setState(previous);
    }, [undoStack, state]);

    // 되돌아가기
    const redo = useCallback(() => {
        if(redoStack.length === 0) return;

        const next = redoStack[0];
        const newRedoStack = redoStack.slice(1);

        setUndoStack((prev) => [...prev, state]); // 현재 상태를 Undo 스택으로 보냄
        setRedoStack(newRedoStack);
        setState(next);
    }, [redoStack, state]);
    
    return {state, setState, setWithHistory, undo, redo};
}