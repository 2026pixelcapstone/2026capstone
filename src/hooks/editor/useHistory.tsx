import { useCallback, useReducer } from "react";
import {MAX_HISTORY_SIZE} from '../../constants/editor'

// 1. 상태 타입 정의
interface HistoryState<T>{
    past: T[];
    present: T;
    future: T[];
}

// 2. 액션 타입 정의
type HistoryAction<T> = 
    | {type: "SET"; newPresent: T | ((prev: T) => T)}
    | {type: "SET_WITHOUT_HISTORY"; newPresent: T | ((prev: T) => T)}
    | {type: "UNDO"}
    | {type: "REDO"}
    | {type: "RESET"; newPresent: T};

// 3. 순수 리듀서 함수 (Side-effect 없음, 예측 가능성 높음)
function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
    const { past, present, future } = state;

    switch (action.type){
        // 새로운 현재가 들어왔을 때 발생하는 과거/현재/미래의 변경
        case "SET": { 
            // *질문1: 왜 함수로 받을까 말까가 나뉠까요?
            // *질문2: 왜 참일 때와 거짓일 때 둘다 newPresent를 쓰는가
            const resolvedPresent = action.newPresent instanceof Function
                ? action.newPresent(present) : action.newPresent;
            // 현재 값과 동일하면 상태를 변경하지 않음
            if(resolvedPresent === present) return state;

            const newPast = [...past, present]; // 현재가 과거에 쌓인다

            return {
                // 기록이 최대치를 넘어가면 맨 처음에 들어왔던 것 부터 삭제함
                past: newPast.length > MAX_HISTORY_SIZE ? newPast.slice(1) : newPast,
                present: resolvedPresent,
                future: [], // 새로운 변경이 들어오면 redo는 초기화
            };
        }
        case "SET_WITHOUT_HISTORY": {
            const resolvedPresent = action.newPresent instanceof Function
                ? action.newPresent(present) : action.newPresent;

            if(resolvedPresent === present) return state;

            return {
                ...state,
                present: resolvedPresent // past, future은 건드리지 않고 present만 교체
            }
        }
        case "UNDO": {
            if(past.length === 0) return state;
            
            const previous = past[past.length - 1]; // 현재(과거(undo)의 라스트) 요소를 서치함
            const newPast = past.slice(0, -1); // undo의 라스트 요소를 제외한 나머지 요소를 서치함

            return {
                past: newPast,
                present: previous, // *질문3: past[past.length -1]이라면 배열은 0부터 시작하니까 undo 하지 않았을 때의 현재 모습 아닌가요?
                future: [present, ...future], // 현재 상태는 future의 맨 앞으로
            }
        }
        case "REDO": {
            if(future.length === 0) return state;

            const next = future[0]; // 바로 앞 미래 서치
            const newFuture = future.slice(1) // 바로 앞 후에 있는 미래만 남김
            
            const newPast = [...past, present];
            return {
                past: newPast,
                present: next,
                future: newFuture
            }
        }
        case "RESET": {
            return {
                past: [],
                present: action.newPresent,
                future: [],
            };
        }
    }
}

export function useHistory<T>(initialState: T){
    // *질문4: useReducer은 어떻게 작동하나요? 
    // ***새로 알게된 것
    // -> 외부에서는 state를 주는게 아니라 가공할 로직을 준다
    // -> useReducer은 함수 고유 내용을 커스텀할 수 있으며, 정의한 상태 객체를 매개변수화 시켜 컨트롤한다
    const [history, dispatch] = useReducer(historyReducer<T>, {
        past: [],
        present: initialState,
        future: [],
    });

    // 객체와 함수를 매개변수로 받아서 매게변수로 받은 newPresent를 배열에 추가
    const setWithHistory = useCallback((value: T | ((prev: T) => T)) => {
        dispatch({ type: "SET", newPresent: value});
    }, []);
    
    const setWithoutHistory = useCallback((value: T | ((prev: T) => T)) => {
        dispatch({ type: "SET_WITHOUT_HISTORY", newPresent: value});
    }, []);
    // undo/redo -> 타입을 보내주면 기존에 저장되어있는 배열 객체로 처리
    const undo = useCallback(() => {
        dispatch({type: "UNDO"});
    }, [])

    const redo = useCallback(() => {
        dispatch({type: "REDO"});
    }, [])

    // 매개변수로 받은 newPresent로 리셋함
    const reset = useCallback((newPresent: T) => {
        dispatch({type: "RESET", newPresent});
    }, [])

    return {
        state: history.present,
        setWithHistory,
        setWithoutHistory,
        undo,
        redo,
        reset,
        // *질문5: canUndo/canRedo는 이게 유효한 지 확인하는 용도로 쓰이나요? 
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        historyLength: history.past.length,
    }
}