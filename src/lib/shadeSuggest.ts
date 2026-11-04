import type { ShadeSuggestResult } from '../api/aiApi'

/** 명암 제안(자체 모델) 화면 쪽 계산 — 그림 자르기·응답 검증·명암 레이어 만들기. 서버 규칙과 맞춘 값. */
export const SHADE_MAX_SIDE = 128     // v2 — 서버가 64 이하는 64, 그 이상은 128 캔버스로 계산
export const SHADE_MIN_OPAQUE = 100   // 이보다 작은 그림은 대상 아님

/** 보낸 그림(불투명 부분만 자른 것)과 캔버스 안 위치 */
export interface ShadeCrop {
  x: number
  y: number
  width: number
  height: number
  rgba: Uint8ClampedArray   // 자른 그림 픽셀(행 우선 RGBA)
  dataUrl: string           // 서버로 보낼 PNG
  opaque: number            // 불투명 칸 수
}

/** 캔버스(현재 프레임 합성)에서 불투명 부분만 잘라 낸다. 비어 있으면 null */
export function cropOpaque(source: HTMLCanvasElement): ShadeCrop | null {
  const w = source.width
  const h = source.height
  const ctx = source.getContext('2d')
  if (!ctx || w === 0 || h === 0) return null
  const all = ctx.getImageData(0, 0, w, h).data

  let minX = w, minY = h, maxX = -1, maxY = -1, opaque = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (all[(y * w + x) * 4 + 3] !== 0) {
        opaque++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null

  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const rgba = new Uint8ClampedArray(cw * ch * 4)
  for (let y = 0; y < ch; y++) {
    const from = ((minY + y) * w + minX) * 4
    rgba.set(all.subarray(from, from + cw * 4), y * cw * 4)
  }
  // 최대 크기를 넘으면 보내지 않으므로 PNG도 만들지 않는다
  let dataUrl = ''
  if (cw <= SHADE_MAX_SIDE && ch <= SHADE_MAX_SIDE) {
    dataUrl = rgbaToCanvas(rgba, cw, ch).toDataURL('image/png')
  }
  return { x: minX, y: minY, width: cw, height: ch, rgba, dataUrl, opaque }
}

/** 서버 응답 형식 확인(TS 타입은 실제 값을 보장하지 않음) */
export function isValidShadeResult(r: unknown, width: number, height: number): r is ShadeSuggestResult {
  const hex = /^#[0-9a-fA-F]{6}$/
  const res = r as ShadeSuggestResult
  if (!res || res.width !== width || res.height !== height) return false
  if (!Array.isArray(res.levels) || res.levels.length !== height) return false
  const rowsOk = res.levels.every((row) => Array.isArray(row) && row.length === width
    && row.every((v) => v === null || (Number.isInteger(v) && v >= -2 && v <= 2)))
  if (!rowsOk || !Array.isArray(res.materials)) return false
  const materialsOk = res.materials.every((m) => m && typeof m.base === 'string' && hex.test(m.base) && m.ramp
    && ['-2', '-1', '0', '1', '2'].every((k) => typeof m.ramp[k] === 'string' && hex.test(m.ramp[k])))
  if (!materialsOk) return false
  // 강도별 결과: 길이 width×height, '.'(대상 아님) 자리는 levels의 null 자리와 같아야
  if (!Array.isArray(res.strengths) || res.strengths.length === 0 || !res.levelsByStrength
    || !res.strengths.includes(res.defaultStrength)) return false
  return res.strengths.every((k) => {
    const s = res.levelsByStrength[String(k)]
    if (typeof s !== 'string' || s.length !== width * height) return false
    for (let i = 0; i < s.length; i++) {
      const none = res.levels[Math.floor(i / width)][i % width] === null
      const c = s.charCodeAt(i)
      if (none ? s[i] !== '.' : c < 48 || c > 52) return false   // '0'(48)~'4'(52)
    }
    return true
  })
}

/**
 * 명암이 바뀌는 칸만 칠한 그림(자른 크기). 재질은 칸의 원래 색으로 찾는다(서버 재질 기준색 = 원래 색).
 * 외곽선·투명·단계 0·반투명 칸은 비운다. strength는 서버가 보낸 강도 중 하나(levelsByStrength의 그 결과를 씀).
 */
export function buildShadeOverlay(crop: ShadeCrop, result: ShadeSuggestResult, strength: number) {
  const levels = result.levelsByStrength[String(strength)] ?? result.levelsByStrength[String(result.defaultStrength)]
  const ramps = new Map<number, Record<string, string>>()
  for (const m of result.materials) ramps.set(parseInt(m.base.slice(1), 16), m.ramp)

  const { width: w, height: h, rgba } = crop
  const out = new Uint8ClampedArray(w * h * 4)
  let changed = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = levels[y * w + x]
      if (ch === '.' || ch === '2') continue                          // 대상 아님 · 단계 0
      const lv = Number(ch) - 2
      const i = (y * w + x) * 4
      if (rgba[i + 3] !== 255) continue
      const ramp = ramps.get((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2])
      if (!ramp) continue
      const c = parseInt(ramp[String(lv)].slice(1), 16)
      out[i] = (c >> 16) & 255
      out[i + 1] = (c >> 8) & 255
      out[i + 2] = c & 255
      out[i + 3] = 255
      changed++
    }
  }
  return { canvas: rgbaToCanvas(out, w, h), changed }
}

/** 자른 크기 명암 그림을 캔버스 크기 레이어 그림(PNG data URL)으로 */
export function toLayerPixelData(overlay: HTMLCanvasElement, crop: ShadeCrop, canvasW: number, canvasH: number): string {
  const full = document.createElement('canvas')
  full.width = canvasW
  full.height = canvasH
  const ctx = full.getContext('2d')
  if (!ctx) return ''
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(overlay, crop.x, crop.y)
  return full.toDataURL('image/png')
}

export function rgbaToCanvas(rgba: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0)
  return c
}
