// 에디터 CanvasData ↔ .ppit(PpitFile) 변환
// 🔴 opacity 스케일 차이: 에디터 레이어 = 0~100, .ppit 스펙 = 0.0~1.0
import type { CanvasData, BlendMode } from '../type/editorType'
import { PPIT_DEFAULT_FPS, type PpitFile } from '../lib/ppit'

const EDITOR_OPACITY_MAX = 100

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1
}

// 1x1 투명 PNG — 빈 레이어용 (parsePpit는 data:image/ 접두사를 요구하므로 round-trip 보장)
const TRANSPARENT_PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'

// 서버에서 온 레이어는 prefix 없는 순수 base64일 수 있어 보정. 빈 레이어는 투명 PNG로.
function ensureDataUrl(pixelData: string): string {
  if (!pixelData) return TRANSPARENT_PNG_1X1
  return pixelData.startsWith('data:') ? pixelData : `data:image/png;base64,${pixelData}`
}

/** 에디터 CanvasData → .ppit (opacity 0~100 → 0.0~1.0) */
export function canvasDataToPpit(
  state: CanvasData,
  paletteColors: string[],
  fps: number = PPIT_DEFAULT_FPS,
): PpitFile {
  return {
    format: 'ppit',
    version: 1,
    canvas: { width: state.width, height: state.height, backgroundColor: '#00000000', fps },
    palette: paletteColors.length > 0 ? { colors: [...paletteColors] } : undefined,
    frames: state.frames.map((f, fi) => ({
      id: f.id || `frame-${fi}`,
      layers: f.layers.map((l, li) => ({
        id: l.id,
        name: l.name,
        layerOrder: l.layerOrder ?? li,
        blendMode: l.blendMode,
        opacity: clamp01((l.opacity ?? EDITOR_OPACITY_MAX) / EDITOR_OPACITY_MAX),
        isVisible: l.isVisible,
        isLocked: l.isLocked,
        color: l.color,
        pixelData: ensureDataUrl(l.pixelData),
      })),
    })),
  }
}

/** .ppit → 에디터 CanvasData (opacity 0.0~1.0 → 0~100) */
export function ppitToCanvasData(ppit: PpitFile): CanvasData {
  return {
    width: ppit.canvas.width,
    height: ppit.canvas.height,
    frames: ppit.frames.map((f, fi) => ({
      id: f.id || `frame-${fi}`,
      layers: [...f.layers]
        .sort((a, b) => a.layerOrder - b.layerOrder)
        .map((l) => ({
          id: l.id,
          name: l.name,
          layerOrder: l.layerOrder,
          blendMode: l.blendMode as BlendMode,
          isLocked: l.isLocked,
          isVisible: l.isVisible,
          opacity: Math.round(clamp01(l.opacity) * EDITOR_OPACITY_MAX),
          color: l.color,
          pixelData: l.pixelData,
        })),
    })),
  }
}
