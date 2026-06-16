import { useState, useCallback } from "react";
import {MAX_HISTORY_SIZE} from '../../constants/editor'

export function useHistory<T>(initialState: T){
    // 데이터 무결성을 위해 let 대신 const를 씀
    const [state, setState] = useState<T>(initialState);
    const [_undoStack, setUndoStack] = useState<T[]>([]);
    const [_redoStack, setRedoStack] = useState<T[]>([]);

    // (new 작업이 들어왔을 때)새로운 상태로 업데이트
    const setWithHistory = useCallback((value: T | ((prev: T) => T )) => {
        setState(currentState => {
            const newState = value instanceof Function ? value(currentState) : value;
            setUndoStack((prev) =>{ 
                const next = [...prev, currentState];
                return next.length > MAX_HISTORY_SIZE ? next.slice(1) : next;
            });
            setRedoStack([]); 
            return newState;
        });
    }, []);

    // 뒤로가기
    const undo = useCallback(() => {
        setUndoStack((currentUndoStack) => {
            if(currentUndoStack.length === 0) return currentUndoStack;
             // 가장 최근 과거인 맨 뒤(length - 1) 스냅샷을 꺼내 현재 state로 복구하고, 나머지만 undoStack에 반영
            const previous = currentUndoStack[currentUndoStack.length - 1]
            const newUndoStack = currentUndoStack.slice(0, -1); // 마지막 아이템을 제외한 나머지만 복사

            setState((currentState) => {
                setRedoStack((prevRedo) => [currentState, ...prevRedo]); // unshift 사용(스택이 역순으로 쌓이기 때문에 0번째가 다음 redo 시 현재 state가 된다)
                return previous;
            });
            return newUndoStack;
        })
    }, []);

    // 되돌아가기
    const redo = useCallback(() => {
        setRedoStack((currentRedoStack) => { //RedoStack 갱신 
            if(currentRedoStack.length === 0) return currentRedoStack;
            
            // 취소된 미래 중 가장 최신인 0번째 스냅샷을 꺼내 현재 state로 복구하고, 나머지만 redoStack에 반영
            const next = currentRedoStack[0];
            const newRedoStack = currentRedoStack.slice(1);

            setState((currentState) => {
                setUndoStack((prevUndo) => [...prevUndo, currentState]);  // 현재 상태를 Undo 스택으로 보냄(과거 기록 누적)
                return next;
            })
            return newRedoStack;
        })
    }, []);
    
    return {state, setState, setWithHistory, undo, redo};
}