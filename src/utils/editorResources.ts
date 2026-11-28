import { MAX_FRAME_LAYERS, MAX_PROJECT_FRAMES, MAX_PROJECT_PIXELS } from '../constants/editor/editor';
import type { CanvasState } from '../type/editor';

// 받은 정보를 기반으로 리소스 상태를 리턴함
export function projectResources(state: CanvasState) {
    const layers = state.frames.reduce((sum, frame) => sum + frame.layers.length, 0);
    return { 
        layers, 
        pixels: state.width * state.height * layers,
        frames: state.frames.length, 
        maxLayers: Math.max(0, ...state.frames.map(f => f.layers.length)) 
    };
}

// 받은 정보를 기반으로 리소스 한도를 초과하였는지 체크함 
export function resourceError(next: CanvasState, previous?: CanvasState): string | null {
    const n = projectResources(next);
    const p = previous ? projectResources(previous) : null;
    if (n.frames > MAX_PROJECT_FRAMES && (!p || n.frames > p.frames))
        return `프레임은 최대 ${MAX_PROJECT_FRAMES}개까지 추가할 수 있어요.`;
    if (next.frames.some(f => f.layers.length > MAX_FRAME_LAYERS &&
        (!previous || f.layers.length > (previous.frames.find(old => old.id === f.id)?.layers.length ?? 0))))
        return `한 프레임의 레이어는 최대 ${MAX_FRAME_LAYERS}개예요.`;
    if (n.pixels > MAX_PROJECT_PIXELS && (!p || n.pixels > p.pixels))
        return '프로젝트 리소스 한도를 초과해요. 캔버스 크기나 프레임·레이어 수를 줄여 주세요.';
    return null;
}

// 리소스 한도를 초과하였는지 체크하고, 초과하였다면 에러를 발생시킴
export function assertResources(next: CanvasState, previous?: CanvasState) {
    const error = resourceError(next, previous);
    if (error) throw new Error(error);
}
