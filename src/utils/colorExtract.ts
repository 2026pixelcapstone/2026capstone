/**
 * 캔버스에서 실제 사용된 색(유니크 hex, 투명 픽셀 제외)을 수집한다.
 * 픽셀아트는 색 수가 적지만, 큰 캔버스 대비 상한(max)으로 안전장치를 둔다.
 *
 * @param canvas 대상 캔버스(Konva stage.toCanvas() 등)
 * @param max    최대 색 개수(요청 payload 방어)
 * @returns #RRGGBB 대문자 hex 배열
 */
export function extractUsedColors(canvas: HTMLCanvasElement, max = 64): string[] {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const set = new Set<string>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue // 완전 투명 픽셀 제외
    const hex =
      '#' +
      [data[i], data[i + 1], data[i + 2]]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
    set.add(hex.toUpperCase())
    if (set.size >= max) break
  }
  return [...set]
}
