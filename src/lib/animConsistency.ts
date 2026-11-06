/**
 * 애니메이션 일관성 검사(학습 없는 색 규칙) — ml/scripts/fg_seqcheck.py feats()를 그대로 옮김.
 * 프레임 k를 나머지 프레임 전체와 비교한 '튀는 정도'(나머지 프레임끼리의 흔들림으로 나눔):
 *   팔레트 밖 — k에만 있는 색(다른 프레임 어디에도 없는 색)의 칸 수
 *   색 비율   — 색 히스토그램이 나머지 프레임의 중앙값 히스토그램에서 얼마나 먼지(L1)
 * 문턱(ml 조정용 1,200장에서 흠 없는 쪽 90% 분위, 11-06): 팔레트 밖 > 0(재현율 96.6%), 색 비율 > 2.864(색 바꿈 재현율 55.8%).
 * 크기·위치·외곽 오류는 이 규칙으로는 거의 못 잡음(재현율 10%대) → 화면에 '색 규칙 검사'라고 범위를 밝힘.
 */

export const OFF_PALETTE_THRESHOLD = 0
export const COLOR_RATIO_THRESHOLD = 2.864
export const MIN_FRAMES = 3

export interface FrameIssue {
  index: number
  offPalette: number           // 다른 프레임에 없는 색 칸 수
  offScore: number
  ratioScore: number
  flagged: boolean
  reasons: string[]
  /** 강조할 칸(캔버스 좌표 y*w+x) */
  marks: number[]
  /** 색 비율이 튀면 가장 많이 달라진 색 */
  ratioColors: string[]
}

const key = (d: Uint8ClampedArray, i: number) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]
const hex = (k: number) => '#' + k.toString(16).padStart(6, '0')

function median(v: number[]): number {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function checkConsistency(frames: ImageData[]): FrameIssue[] {
  const n = frames.length
  if (n < MIN_FRAMES) return []
  // 프레임별 색 칸 수
  const counts: Map<number, number>[] = frames.map((f) => {
    const m = new Map<number, number>()
    const d = f.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      const k = key(d, i)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  })
  const allColors = [...new Set(counts.flatMap((m) => [...m.keys()]))]
  const hist = counts.map((m) => {
    const tot = [...m.values()].reduce((a, b) => a + b, 0) || 1
    return allColors.map((c) => (m.get(c) ?? 0) / tot)
  })
  // 프레임 j마다 원시 값(나머지와의 차이)
  const raw = frames.map((_, j) => {
    const others = counts.filter((_, i) => i !== j)
    const otherSet = new Set(others.flatMap((m) => [...m.keys()]))
    let off = 0
    for (const [c, v] of counts[j]) if (!otherSet.has(c)) off += v
    const medHist = allColors.map((_, ci) => median(hist.filter((_, i) => i !== j).map((h) => h[ci])))
    const col = hist[j].reduce((s, v, ci) => s + Math.abs(v - medHist[ci]), 0)
    return { off, col, medHist, otherSet }
  })
  return frames.map((f, k) => {
    const rest = raw.filter((_, i) => i !== k)
    const z = (vals: number[], x: number, base: number) => {
      const m = median(vals)
      const mad = median(vals.map((v) => Math.abs(v - m)))
      return (x - m) / (mad + base)
    }
    const offScore = z(rest.map((r) => r.off), raw[k].off, 1)
    const ratioScore = z(rest.map((r) => r.col), raw[k].col, 0.02)
    const reasons: string[] = []
    const marks: number[] = []
    let ratioColors: string[] = []
    const d = f.data
    if (offScore > OFF_PALETTE_THRESHOLD && raw[k].off > 0) {
      reasons.push(`다른 프레임에 없는 색 ${raw[k].off}칸`)
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] && !raw[k].otherSet.has(key(d, i))) marks.push(i / 4)
    }
    if (ratioScore > COLOR_RATIO_THRESHOLD) {
      const diff = allColors.map((c, ci) => ({ c, v: hist[k][ci] - raw[k].medHist[ci] }))
        .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 2)
      ratioColors = diff.map((x) => hex(x.c))
      reasons.push(`색 비율이 다른 프레임과 다름(${diff.map((x) => `${hex(x.c)} ${x.v > 0 ? '많음' : '적음'}`).join(', ')})`)
      const set = new Set(diff.filter((x) => x.v > 0).map((x) => x.c))
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] && set.has(key(d, i))) marks.push(i / 4)
    }
    return { index: k, offPalette: raw[k].off, offScore, ratioScore, flagged: reasons.length > 0, reasons, marks, ratioColors }
  })
}
