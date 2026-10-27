import { useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import { aiApi, type ShadeSuggestResult } from '../../api/aiApi'
import { toast } from '../../store/toastStore'
import { getErrorMessage } from '../../lib/errorUtils'
import {
  SHADE_MAX_SIDE, SHADE_MIN_OPAQUE, buildShadeOverlay, cropOpaque, isValidShadeResult, rgbaToCanvas,
  toLayerPixelData, type ShadeCrop, type ShadeStrength,
} from '../../lib/shadeSuggest'

/** 광원 8방향(3×3에서 가운데 제외). 각도는 0=오른쪽, 90=위 — 모델 규칙 */
const DIRECTIONS: { angle: number | null; arrow: string; label: string }[] = [
  { angle: 135, arrow: '↖', label: '왼쪽 위' },
  { angle: 90, arrow: '↑', label: '위' },
  { angle: 45, arrow: '↗', label: '오른쪽 위' },
  { angle: 180, arrow: '←', label: '왼쪽' },
  { angle: null, arrow: '☀', label: '' },
  { angle: 0, arrow: '→', label: '오른쪽' },
  { angle: 225, arrow: '↙', label: '왼쪽 아래' },
  { angle: 270, arrow: '↓', label: '아래' },
  { angle: 315, arrow: '↘', label: '오른쪽 아래' },
]
const PREVIEW_BOX = 280   // 미리보기 최대 한 변(px)

/** 요청 시점 기준 결과 — 이후 그림을 고쳐도 이 그림 기준으로 추가 */
interface ShadeSnapshot {
  crop: ShadeCrop
  data: ShadeSuggestResult
  frameId: string
  canvasW: number
  canvasH: number
  angle: number
}

interface Props {
  stageRef: React.RefObject<Konva.Stage | null>
  frameId: string | null
  canvasW: number
  canvasH: number
  /** 요청한 프레임에 '명암 제안' 레이어 추가. 프레임이 없으면 false */
  onAddLayer: (frameId: string, pixelData: string) => boolean
}

/** 에디터 AI 패널 — 명암 제안(자체 모델). 원본 레이어는 건드리지 않고 바뀌는 칸만 새 레이어로 */
export default function ShadeSuggestPanel({ stageRef, frameId, canvasW, canvasH, onAddLayer }: Props) {
  const [angle, setAngle] = useState(135)
  const [loading, setLoading] = useState(false)
  const [snap, setSnap] = useState<ShadeSnapshot | null>(null)
  const [strength, setStrength] = useState<ShadeStrength>(1)
  const [showOriginal, setShowOriginal] = useState(false)
  const reqIdRef = useRef(0)            // 세대 가드(늦게 온 응답이 최신 결과를 덮지 않게)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const overlay = useMemo(() => (snap ? buildShadeOverlay(snap.crop, snap.data, strength) : null), [snap, strength])

  // 미리보기 — 원본 위에 명암 칸을 얹어 확대(픽셀 그대로)
  useEffect(() => {
    const cv = previewRef.current
    if (!cv || !snap || !overlay) return
    const { crop } = snap
    const scale = Math.max(1, Math.floor(PREVIEW_BOX / Math.max(crop.width, crop.height)))
    cv.width = crop.width * scale
    cv.height = crop.height * scale
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(rgbaToCanvas(crop.rgba, crop.width, crop.height), 0, 0, cv.width, cv.height)
    if (!showOriginal) ctx.drawImage(overlay.canvas, 0, 0, cv.width, cv.height)
  }, [snap, overlay, showOriginal])

  const handleSuggest = async () => {
    const stage = stageRef.current
    if (!stage || !frameId || loading) return
    const crop = cropOpaque(stage.toCanvas({ pixelRatio: 1 }))   // 현재 프레임에서 보이는 레이어 합성
    if (!crop) {
      toast.error('그림이 비어 있습니다.')
      return
    }
    if (crop.width > SHADE_MAX_SIDE || crop.height > SHADE_MAX_SIDE) {
      toast.error(`그림 부분이 ${SHADE_MAX_SIDE}×${SHADE_MAX_SIDE}를 넘어 명암 제안을 할 수 없습니다(${crop.width}×${crop.height}).`)
      return
    }
    if (crop.opaque < SHADE_MIN_OPAQUE) {
      toast.error(`불투명 칸이 ${SHADE_MIN_OPAQUE}칸 이상인 그림만 명암 제안을 할 수 있습니다.`)
      return
    }
    const reqId = ++reqIdRef.current
    const req = { frameId, canvasW, canvasH, angle }
    setLoading(true)
    try {
      const res = await aiApi.suggestShade({ imageBase64: crop.dataUrl, angle: req.angle })
      if (reqIdRef.current !== reqId) return
      const data = res.data?.data
      if (!isValidShadeResult(data, crop.width, crop.height)) {
        throw new Error('명암 제안 응답 형식이 올바르지 않습니다.')
      }
      setSnap({ crop, data, ...req })
      setShowOriginal(false)
    } catch (e) {
      if (reqIdRef.current !== reqId) return
      toast.error(getErrorMessage(e, '명암 제안에 실패했습니다.'))
    } finally {
      if (reqIdRef.current === reqId) setLoading(false)
    }
  }

  const handleAdd = () => {
    if (!snap || !overlay) return
    if (overlay.changed === 0) {
      toast.error('바뀌는 칸이 없어 추가할 레이어가 없습니다.')
      return
    }
    if (snap.canvasW !== canvasW || snap.canvasH !== canvasH) {
      toast.error('요청 뒤 캔버스 크기가 바뀌었습니다. 명암 제안을 다시 받아 주세요.')
      return
    }
    const pixelData = toLayerPixelData(overlay.canvas, snap.crop, snap.canvasW, snap.canvasH)
    if (!pixelData || !onAddLayer(snap.frameId, pixelData)) {
      toast.error('명암을 요청한 프레임이 없어 추가할 수 없습니다.')
      return
    }
    toast.success('‘명암 제안’ 레이어를 추가했습니다.')
  }

  const angleLabel = (a: number) => DIRECTIONS.find((d) => d.angle === a)?.label ?? `${a}°`
  const sizeChanged = snap && (snap.canvasW !== canvasW || snap.canvasH !== canvasH)

  return (
    <div className="p-3 rounded-lg bg-surface-container-low border border-outline">
      <div className="text-[11px] mb-2 text-on-surface-variant">광원 방향</div>
      <div className="grid grid-cols-3 gap-1 w-24 mb-2">
        {DIRECTIONS.map((d) =>
          d.angle === null ? (
            <span key="center" className="aspect-square flex items-center justify-center text-sm text-on-surface-variant">{d.arrow}</span>
          ) : (
            <button
              key={d.angle}
              type="button"
              title={d.label}
              aria-label={`광원 ${d.label}`}
              aria-pressed={angle === d.angle}
              onClick={() => setAngle(d.angle as number)}
              className="aspect-square rounded border text-sm transition-all hover:bg-surface-container"
              style={angle === d.angle
                ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: 'var(--color-background)' }
                : { borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}
            >
              {d.arrow}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={handleSuggest}
        disabled={loading || !frameId}
        className="w-full py-1.5 text-xs font-bold rounded-lg text-white disabled:opacity-50"
        style={{ background: 'var(--color-primary)' }}
      >
        {loading ? '계산 중…' : '명암 제안 받기'}
      </button>
      <p className="mt-1 text-[10px] text-on-surface-variant">
        {SHADE_MAX_SIDE}×{SHADE_MAX_SIDE} 이하 그림 · 같은 사람은 5초에 한 번
      </p>

      {snap && overlay && (
        <div className="mt-3">
          <div className="flex gap-1 mb-2">
            {([false, true] as const).map((orig) => (
              <button
                key={String(orig)}
                type="button"
                aria-pressed={showOriginal === orig}
                onClick={() => setShowOriginal(orig)}
                className="flex-1 py-1 text-[11px] font-bold rounded border"
                style={showOriginal === orig
                  ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                  : { borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}
              >
                {orig ? '원본' : '제안'}
              </button>
            ))}
          </div>
          <div className="flex justify-center p-2 rounded border mb-2"
            style={{ borderColor: 'var(--color-outline)', background: 'var(--color-surface)' }}>
            <canvas ref={previewRef} style={{ imageRendering: 'pixelated', maxWidth: '100%' }}
              aria-label={showOriginal ? '원본 미리보기' : '명암 제안 미리보기'} role="img" />
          </div>
          <div className="text-[11px] mb-1 text-on-surface-variant">강도</div>
          <div className="flex gap-1 mb-2">
            {([1, 2] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={strength === s}
                onClick={() => setStrength(s)}
                className="flex-1 py-1 text-[11px] font-bold rounded border"
                style={strength === s
                  ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                  : { borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}
              >
                {s === 1 ? '약하게 (1단계)' : '강하게 (2단계)'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={overlay.changed === 0 || !!sizeChanged}
            className="w-full py-1.5 text-xs font-bold rounded-lg border hover:bg-surface-container disabled:opacity-50"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            + 새 레이어로 추가
          </button>
          <p className="mt-1 text-[10px] text-on-surface-variant">
            요청 시점 그림 기준 · 광원 {angleLabel(snap.angle)} · 바뀌는 칸 {overlay.changed}칸
            {sizeChanged ? ' · 캔버스 크기가 바뀌어 다시 받아야 합니다' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
