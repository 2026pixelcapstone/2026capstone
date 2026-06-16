// .ppit (PixelPilot 전용 포맷) 파서 + 합성 렌더러 + 썸네일/GIF 생성
// 스펙: 전용갤러리_ppit_스펙.md §2~§3. 정본 JSON을 인메모리 모델로 파싱하고,
// 레이어 PNG(dataURL)를 layerOrder순 + opacity/blendMode로 합성한다.
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { PaletteData } from '../api/galleryApi'

export interface PpitLayer {
  id: string
  name: string
  layerOrder: number
  blendMode: string       // NORMAL|MULTIPLY|SCREEN|OVERLAY|DARKEN|LIGHTEN
  opacity: number         // 0.0~1.0
  isVisible: boolean
  isLocked: boolean
  color: string | null
  pixelData: string       // 레이어 1장의 PNG dataURL
}

export interface PpitFrame {
  id: string
  layers: PpitLayer[]
}

export interface PpitCanvas {
  width: number
  height: number
  backgroundColor?: string | null
  fps?: number
}

export interface PpitFile {
  format: 'ppit'
  version: number
  canvas: PpitCanvas
  palette?: PaletteData
  frames: PpitFrame[]
}

// blendMode → Canvas globalCompositeOperation (NORMAL은 기본 source-over)
const BLEND_MAP: Record<string, GlobalCompositeOperation> = {
  MULTIPLY: 'multiply',
  SCREEN: 'screen',
  OVERLAY: 'overlay',
  DARKEN: 'darken',
  LIGHTEN: 'lighten',
}

/** 잘못된 .ppit이면 메시지를 가진 Error를 던진다. */
export function parsePpit(text: string): PpitFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('JSON 파싱에 실패했습니다.')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('.ppit 형식이 아닙니다. (최상위가 객체가 아님)')
  }
  const d = raw as Record<string, unknown>
  if (d.format !== 'ppit') {
    throw new Error('.ppit 형식이 아닙니다. (format ≠ "ppit")')
  }

  const canvas = d.canvas as Record<string, unknown> | undefined
  const width = Number(canvas?.width)
  const height = Number(canvas?.height)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('캔버스 크기가 올바르지 않습니다. (canvas.width/height)')
  }

  const framesRaw = d.frames
  if (!Array.isArray(framesRaw) || framesRaw.length === 0) {
    throw new Error('프레임이 없습니다. (frames)')
  }

  const frames: PpitFrame[] = framesRaw.map((f, fi) => {
    const fr = f as Record<string, unknown>
    const layersRaw = Array.isArray(fr.layers) ? fr.layers : []
    const layers: PpitLayer[] = layersRaw.map((l, li) => {
      const ly = l as Record<string, unknown>
      const pixelData = ly.pixelData
      if (typeof pixelData !== 'string' || !pixelData.startsWith('data:image/')) {
        throw new Error(`레이어 픽셀 데이터가 올바르지 않습니다. (frame ${fi}, layer ${li})`)
      }
      return {
        id: String(ly.id ?? `frame${fi}-layer${li}`),
        name: String(ly.name ?? `Layer ${li + 1}`),
        layerOrder: Number(ly.layerOrder ?? li),
        blendMode: String(ly.blendMode ?? 'NORMAL'),
        opacity: clamp01(ly.opacity),
        isVisible: ly.isVisible !== false,
        isLocked: ly.isLocked === true,
        color: typeof ly.color === 'string' ? ly.color : null,
        pixelData,
      }
    })
    return { id: String(fr.id ?? `frame-${fi}`), layers }
  })

  const paletteRaw = d.palette as Record<string, unknown> | undefined
  const palette: PaletteData | undefined = paletteRaw && Array.isArray(paletteRaw.colors)
    ? { name: typeof paletteRaw.name === 'string' ? paletteRaw.name : null, colors: (paletteRaw.colors as unknown[]).map(String) }
    : undefined

  const fpsRaw = Number(canvas?.fps)
  return {
    format: 'ppit',
    version: Number(d.version ?? 1),
    canvas: {
      width,
      height,
      backgroundColor: typeof canvas?.backgroundColor === 'string' ? (canvas.backgroundColor as string) : null,
      fps: Number.isFinite(fpsRaw) && fpsRaw > 0 ? fpsRaw : 12,
    },
    palette,
    frames,
  }
}

function clamp01(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 1
  return Math.max(0, Math.min(1, n))
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('레이어 이미지를 불러오지 못했습니다.'))
    img.src = dataUrl
  })
}

/** 한 프레임을 네이티브 캔버스 크기로 합성한다(layerOrder순 + opacity/blendMode). */
export async function compositeFrame(ppit: PpitFile, frameIndex: number): Promise<HTMLCanvasElement> {
  const { width, height, backgroundColor } = ppit.canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)
  }

  const frame = ppit.frames[frameIndex]
  if (!frame) return canvas
  const layers = [...frame.layers].sort((a, b) => a.layerOrder - b.layerOrder)
  for (const layer of layers) {
    if (!layer.isVisible) continue
    const img = await loadImage(layer.pixelData)
    ctx.globalAlpha = layer.opacity
    ctx.globalCompositeOperation = BLEND_MAP[layer.blendMode] ?? 'source-over'
    ctx.drawImage(img, 0, 0, width, height)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

/** 모든 프레임을 미리 합성(미리보기 애니메이션·GIF 재사용용). */
export async function compositeAllFrames(ppit: PpitFile): Promise<HTMLCanvasElement[]> {
  const out: HTMLCanvasElement[] = []
  for (let i = 0; i < ppit.frames.length; i++) out.push(await compositeFrame(ppit, i))
  return out
}

/** frame 0 합성 → PNG Blob (썸네일/대표 이미지). */
export async function renderThumbnailBlob(ppit: PpitFile): Promise<Blob> {
  const canvas = await compositeFrame(ppit, 0)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('썸네일 생성 실패'))), 'image/png'),
  )
}

/** frames>1이면 fps 적용 애니메이션 GIF Blob, 1프레임이면 null. */
export async function renderGifBlob(ppit: PpitFile, framesCanvas?: HTMLCanvasElement[]): Promise<Blob | null> {
  if (ppit.frames.length <= 1) return null
  const frames = framesCanvas ?? await compositeAllFrames(ppit)
  const { width, height, fps } = ppit.canvas
  const delay = Math.round(1000 / (fps || 12))

  const gif = GIFEncoder()
  for (const canvas of frames) {
    const ctx = canvas.getContext('2d')!
    const { data } = ctx.getImageData(0, 0, width, height)
    // rgba4444로 양자화해 투명도 보존 (픽셀아트 알파)
    const palette = quantize(data, 256, { format: 'rgba4444' })
    const index = applyPalette(data, palette, 'rgba4444')
    gif.writeFrame(index, width, height, { palette, delay, transparent: true })
  }
  gif.finish()
  return new Blob([gif.bytesView()], { type: 'image/gif' })
}

/** .ppit 원본 텍스트를 File로 (R2 업로드용). */
export function ppitTextToFile(text: string, fileName: string): File {
  const safe = fileName.endsWith('.ppit') ? fileName : `${fileName}.ppit`
  return new File([text], safe, { type: 'application/json' })
}
