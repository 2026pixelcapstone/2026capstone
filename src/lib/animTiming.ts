/**
 * 애니메이션 타이밍 점검(학습 없는 규칙) — 교수님 피드백 '재생 속도·프레임 수'(11-17).
 * 근거 측정(ml/reports/15a_timing_gif.md, 작가가 길이를 정한 OGA GIF 343개): 프레임 길이는 움직임 크기로 거의 설명되지 않음
 * (상관 +0.21) → '추천 FPS'는 내지 않고, 계산으로 확실히 말할 수 있는 것만 보여 줌.
 *   - 구간마다 몸 중심 이동(칸)·바뀐 칸 비율·초당 이동 칸 수
 *   - 큰 점프: 이 구간 이동이 다른 구간보다 훨씬 큼 → 사이에 프레임을 넣으면 부드러워짐
 *   - 거의 같은 프레임: 연속 두 장이 거의 같음 → 하나로 합치고 길이를 더해도 같은 움직임
 * 문턱은 제품 규칙(측정한 값 아님): 큰 점프 = 이동 ≥ 3칸이고 ≥ 중앙값 × 2, 또는 바뀐 칸 ≥ 30%이고 ≥ 중앙값 × 2 / 거의 같음 = 바뀐 칸 < 1%.
 * 마지막 → 첫 프레임 구간도 계산(반복 재생 때 이어지는 곳).
 */

export const MIN_FRAMES = 2
export const JUMP_MIN_CELLS = 3
export const JUMP_MIN_RATIO = 0.3
export const JUMP_FACTOR = 2
export const SAME_MAX_RATIO = 0.01

export interface Step {
  from: number          // 범위 안 번호(0부터)
  to: number
  move: number          // 몸 중심 이동(칸)
  changed: number       // 바뀐 칸 비율(0~1, 둘 중 하나라도 그림인 칸 기준)
  perSec: number        // 초당 이동 칸 수(from 프레임 길이 기준)
  jump: boolean
  same: boolean
  wrap: boolean         // 마지막 → 처음
}

function centroid(img: ImageData): [number, number] | null {
  const { data, width, height } = img
  let sx = 0, sy = 0, n = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) { sx += x; sy += y; n++ }
    }
  }
  return n ? [sx / n, sy / n] : null
}

function changedRatio(a: ImageData, b: ImageData): number {
  const da = a.data, db = b.data
  let u = 0, d = 0
  for (let i = 0; i < da.length; i += 4) {
    const oa = da[i + 3] > 0, ob = db[i + 3] > 0
    if (!oa && !ob) continue
    u++
    if (oa !== ob || da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) d++
  }
  return u ? d / u : 0
}

function median(v: number[]): number {
  if (!v.length) return 0
  const s = [...v].sort((p, q) => p - q)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** images: 범위 안 프레임(합성 그림), durations: 같은 순서의 길이(ms) */
export function checkTiming(images: ImageData[], durations: number[]): Step[] {
  const n = images.length
  if (n < MIN_FRAMES) return []
  const cs = images.map(centroid)
  const pairs = n === 2 ? [[0, 1]] : Array.from({ length: n }, (_, i) => [i, (i + 1) % n])
  const raw = pairs.map(([i, j]) => {
    const a = cs[i], b = cs[j]
    const move = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0
    const dur = durations[i] > 0 ? durations[i] : 100
    return { from: i, to: j, move, changed: changedRatio(images[i], images[j]), perSec: move / (dur / 1000), wrap: j < i }
  })
  const mMove = median(raw.map(r => r.move))
  const mChg = median(raw.map(r => r.changed))
  return raw.map(r => ({
    ...r,
    same: r.changed < SAME_MAX_RATIO,
    jump: (r.move >= JUMP_MIN_CELLS && r.move >= mMove * JUMP_FACTOR) || (r.changed >= JUMP_MIN_RATIO && r.changed >= mChg * JUMP_FACTOR),
  }))
}
