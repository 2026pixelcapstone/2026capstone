import type { LayerData } from '../type/editor';

// 히스토리의 레이어 객체가 사라지면 준비된 버퍼도 함께 수거됩니다.
// pixelData는 영구 상태이며 이 버퍼는 재디코딩을 피하기 위한 표시용 원본입니다.
export const resizedLayerCanvases = new WeakMap<LayerData, HTMLCanvasElement>();
