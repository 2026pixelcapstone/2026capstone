export const getCacheKey = (frameIdx: number, layerId: string): string => {
  return `frame-${frameIdx}_${layerId}`;
};


