/**
 * 공동 캔버스 판 데이터 — 페이지와 메인 썸네일이 같이 씀.
 * 판 = 칸마다 색 번호(0~15) 1바이트, 행 우선. 그리기는 <canvas>(size×size)에 칸 = 1픽셀로 칠하고 CSS로 확대(pixelated).
 */

export function decodeBoard(base64: string, size: number): Uint8Array {
  const bin = atob(base64)
  const out = new Uint8Array(size * size)
  for (let i = 0; i < out.length && i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 판 전체 그리기 */
export function drawBoard(ctx: CanvasRenderingContext2D, board: Uint8Array, palette: string[], size: number) {
  const img = ctx.createImageData(size, size)
  const rgb = palette.map(hexToRgb)
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = rgb[board[i]] ?? rgb[0]
    img.data[i * 4] = r
    img.data[i * 4 + 1] = g
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

/** 칸 하나 그리기 */
export function drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}
