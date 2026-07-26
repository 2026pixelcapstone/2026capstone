export const getCacheKey = (frameIdx: number, layerId: string): string => {
  return `frame-${frameIdx}_${layerId}`;
};

// 캔버스에 투명하지 않은 픽셀이 하나라도 있는지 확인하는 함수
export const isCanvasBlank = (canvas: HTMLCanvasElement): boolean => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  
  const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  // Alpha 값(4번째 원소들) 중 0이 아닌 것(투명이 아닌 픽셀)이 하나라도 있는지 검사
  for (let i = 3; i < pixelData.length; i += 4) {
    if (pixelData[i] !== 0) return false; // 그림이 있음!
  }
  return true; // 완전 빈 캔버스임!
};
