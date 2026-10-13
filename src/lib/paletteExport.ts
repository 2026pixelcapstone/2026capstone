/**
 * 팔레트 내보내기·가져오기 — 서버를 거치지 않고 브라우저에서 파일 생성.
 * 형식: .hex(Lospec 기본, 한 줄에 rrggbb) / .gpl(GIMP·Aseprite) / .pal(JASC-PAL, Paint Shop Pro·Aseprite) / PNG(색당 1칸).
 */

/** '#rrggbb' → [r, g, b] */
function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** .hex — 한 줄에 '#' 없는 rrggbb (Lospec 'HEX file') */
export function toHexFile(colors: string[]): string {
  return colors.map(c => c.replace('#', '').toLowerCase()).join('\n') + '\n'
}

/** .gpl — GIMP Palette. 'R G B<TAB>이름' 각 값 3칸 우측 정렬 */
export function toGplFile(name: string, colors: string[]): string {
  const lines = ['GIMP Palette', `Name: ${name.replace(/[\r\n]/g, ' ')}`, `Columns: ${Math.min(colors.length, 16)}`, '#']
  for (const c of colors) {
    const [r, g, b] = toRgb(c)
    lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${c.replace('#', '').toLowerCase()}`)
  }
  return lines.join('\n') + '\n'
}

/** .pal — JASC-PAL: 'JASC-PAL', '0100', 색 개수, 'R G B' 줄들(CRLF) */
export function toJascPalFile(colors: string[]): string {
  const lines = ['JASC-PAL', '0100', String(colors.length), ...colors.map(c => toRgb(c).join(' '))]
  return lines.join('\r\n') + '\r\n'
}

/** PNG — 색 1개당 scale×scale 칸, 가로 한 줄 */
export function toPngBlob(colors: string[], scale: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = colors.length * scale
  canvas.height = scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('canvas 2d unavailable'))
  colors.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.fillRect(i * scale, 0, scale, scale)
  })
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('png encode failed'))), 'image/png'))
}

/** 파일 이름에 못 쓰는 문자 제거 */
export function safeFileName(name: string): string {
  return (name.trim().replace(/[\\/:*?"<>|\r\n]+/g, '_') || 'palette').slice(0, 60)
}

/** 텍스트·Blob을 파일로 저장(같은 출처 blob이라 <a download>가 동작) */
export function saveFile(data: string | Blob, filename: string, mime = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type: `${mime};charset=utf-8` }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 붙여넣은 텍스트에서 색 추출 — '#ff0000', 'ff0000', 콤마·공백·줄바꿈 구분, .hex 파일 내용 모두 허용.
 * 소문자 '#rrggbb'로 통일, 순서 유지 중복 제거.
 */
export function parseHexList(text: string): string[] {
  const found = text.match(/#?\b[0-9a-fA-F]{6}\b/g) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of found) {
    const hex = '#' + raw.replace('#', '').toLowerCase()
    if (!seen.has(hex)) { seen.add(hex); out.push(hex) }
  }
  return out
}
