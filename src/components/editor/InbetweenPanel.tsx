import { useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasState } from '../../type/editor'
import { aiApi, type InbetweenResult } from '../../api/aiApi'
import { renderFrames } from '../../lib/editorExport'
import { toast } from '../../store/toastStore'
import { getErrorMessage } from '../../lib/errorUtils'

interface Props {
  state: CanvasState
  activeFrameId: string | null
  /** afterId 뒤에 레이어 하나짜리 프레임들을 순서대로 넣고 넣은 장수를 돌려줌(되돌리기 한 번) */
  onInsert: (afterId: string, items: { pixelData: string; name: string }[]) => number
}

interface Snapshot {
  data: InbetweenResult
  aId: string
  cId: string
  a: HTMLCanvasElement
  c: HTMLCanvasElement
  w: number
  h: number
}

const BOX = 300
const T_STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

function loadImg(b64: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = rej
    im.src = `data:image/png;base64,${b64}`
  })
}

/**
 * 에디터 AI 패널 — 중간 동작 제안(자체 모델: 작업물 이해 → 규칙으로 사이 프레임).
 * 1) 앞·뒤 키프레임을 골라 요청 → 2) '작업물 해석'(부위 덩어리·관절)을 겹쳐 확인 → 3) 타이밍 슬라이더로 고른 프레임을 넣음.
 * 칸마다 두 프레임을 섞지 않고 부위를 통째로 옮겨 원본 색만 씀. 넣은 뒤 작가가 고쳐 쓰는 '제안'.
 */
export default function InbetweenPanel({ state, activeFrameId, onInsert }: Props) {
  const idx = Math.max(0, state.frames.findIndex((f) => f.id === activeFrameId))
  const [aIdx, setAIdx] = useState(idx)
  const [cIdx, setCIdx] = useState(Math.min(state.frames.length - 1, idx + 1))
  const [loading, setLoading] = useState(false)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [t, setT] = useState(0.5)
  const [showParts, setShowParts] = useState(false)
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement>>({})
  const reqRef = useRef(0)
  const viewRef = useRef<HTMLCanvasElement>(null)

  // 지금 프레임이 바뀌면 앞 = 지금, 뒤 = 다음으로 맞춤(결과는 유지)
  useEffect(() => {
    setAIdx(idx)
    setCIdx(Math.min(state.frames.length - 1, idx + 1))
  }, [idx, state.frames.length])

  const run = async () => {
    const fa = state.frames[aIdx]
    const fc = state.frames[cIdx]
    if (!fa || !fc || aIdx === cIdx) {
      toast.error('서로 다른 앞·뒤 프레임을 골라 주세요.')
      return
    }
    const id = ++reqRef.current
    setLoading(true)
    try {
      const [a, c] = await renderFrames({ ...state, frames: [fa, fc] })
      const b64 = (cv: HTMLCanvasElement) => cv.toDataURL('image/png').split(',')[1]
      const res = await aiApi.suggestInbetween({ imageA: b64(a), imageC: b64(c) })
      const data = res.data.data
      if (!data || !Array.isArray(data.frames) || data.frames.length === 0) throw new Error('응답 형식')
      const loaded: Record<string, HTMLImageElement> = {}
      await Promise.all([...data.frames.map(async (f) => { loaded[f.t.toFixed(1)] = await loadImg(f.image) }),
        loadImg(data.parts).then((im) => { loaded.parts = im })])
      if (id !== reqRef.current) return
      setImgs(loaded)
      setSnap({ data, aId: fa.id, cId: fc.id, a, c, w: state.width, h: state.height })
      setT(0.5)
    } catch (e) {
      if (id === reqRef.current) toast.error(getErrorMessage(e, '중간 동작을 제안하지 못했습니다.'))
    } finally {
      if (id === reqRef.current) setLoading(false)
    }
  }

  // 미리보기: 앞 | 사이(t) | 뒤, 해석 보기면 사이 자리에 A 위로 덩어리 색·관절
  const scale = useMemo(() => (snap ? Math.max(1, Math.floor(BOX / 3 / Math.max(snap.w, snap.h))) : 1), [snap])
  useEffect(() => {
    const cv = viewRef.current
    if (!cv || !snap) return
    const { w, h } = snap
    cv.width = w * scale * 3 + 8
    cv.height = h * scale
    const ctx = cv.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(snap.a, 0, 0, w * scale, h * scale)
    const mid = w * scale + 4
    if (showParts) {
      ctx.drawImage(snap.a, mid, 0, w * scale, h * scale)
      if (imgs.parts) {
        ctx.globalAlpha = 0.65
        ctx.drawImage(imgs.parts, mid, 0, w * scale, h * scale)
        ctx.globalAlpha = 1
      }
      ctx.fillStyle = '#000'
      for (const j of snap.data.joints) {
        ctx.beginPath()
        ctx.arc(mid + j.x * scale, j.y * scale, Math.max(2, scale * 0.6), 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      const im = imgs[t.toFixed(1)]
      if (im) ctx.drawImage(im, mid, 0, w * scale, h * scale)
    }
    ctx.drawImage(snap.c, w * scale * 2 + 8, 0, w * scale, h * scale)
  }, [snap, imgs, t, showParts, scale])

  const insert = (ts: number[]) => {
    if (!snap) return
    if (!state.frames.some((f) => f.id === snap.aId)) {
      toast.error('앞 프레임이 지워져 넣을 수 없습니다. 다시 제안받아 주세요.')
      return
    }
    const items = ts.map((tt) => snap.data.frames.find((x) => Math.abs(x.t - tt) < 1e-6))
      .filter((f): f is { t: number; image: string } => !!f)
      .map((f) => ({ pixelData: `data:image/png;base64,${f.image}`, name: `중간 동작 제안 t=${f.t.toFixed(1)}` }))
    const n = onInsert(snap.aId, items)
    if (!n) return
    toast.success(`${n}장을 앞 프레임 뒤에 넣었습니다. 고쳐서 쓰세요.`)
  }

  const frameOpts = state.frames.map((_, i) => <option key={i} value={i}>프레임 {i + 1}</option>)

  return (
    <div className="p-3 rounded-lg bg-surface-container-low border border-outline space-y-3">
      <p className="text-[11px] text-on-surface-variant leading-relaxed">
        두 키프레임 사이 동작을 <b>제안</b>합니다. AI가 먼저 그림을 <b>부위·관절로 해석</b>하고, 부위를 통째로 돌려 원본 색만 씁니다.
        몸이 3D로 도는 동작·앞 프레임에 없던 부분은 지원하지 않습니다(그림 부분 60칸 이하).
      </p>
      <div className="flex items-center gap-2 text-xs text-on-surface">
        <select value={aIdx} onChange={(e) => setAIdx(Number(e.target.value))} aria-label="앞 키프레임"
          className="flex-1 p-1.5 rounded border bg-surface border-outline">{frameOpts}</select>
        <span>→</span>
        <select value={cIdx} onChange={(e) => setCIdx(Number(e.target.value))} aria-label="뒤 키프레임"
          className="flex-1 p-1.5 rounded border bg-surface border-outline">{frameOpts}</select>
      </div>
      <button type="button" onClick={run} disabled={loading || state.frames.length < 2}
        className="w-full py-1.5 text-xs font-bold rounded-lg text-white bg-primary disabled:opacity-50">
        {loading ? '해석하고 그리는 중…' : state.frames.length < 2 ? '프레임이 2장 이상 필요' : '중간 동작 제안'}
      </button>

      {snap && (
        <div className="space-y-2" role="status">
          <canvas ref={viewRef} className="w-full rounded border border-outline bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] bg-[length:8px_8px]" style={{ imageRendering: 'pixelated' }} />
          <div className="flex justify-between text-[10px] text-on-surface-variant"><span>앞</span><span>{showParts ? '작업물 해석' : `사이 t=${t.toFixed(1)}`}</span><span>뒤</span></div>
          <label className="flex items-center gap-2 text-[11px] text-on-surface">
            <input type="checkbox" checked={showParts} onChange={(e) => setShowParts(e.target.checked)} />
            작업물 해석 보기(부위 {snap.data.partCount}개 · 관절 {snap.data.joints.length}개)
          </label>
          <label className="block text-[11px] text-on-surface">
            타이밍 {t <= 0.3 ? '(앞에 가깝게)' : t >= 0.7 ? '(뒤에 가깝게)' : '(가운데)'}
            <input type="range" min={0} max={T_STEPS.length - 1} step={1} value={T_STEPS.indexOf(Number(t.toFixed(1)))}
              onChange={(e) => { setT(T_STEPS[Number(e.target.value)]); setShowParts(false) }} className="w-full" aria-label="타이밍" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => insert([t])}
              className="py-1.5 text-xs font-bold rounded-lg border border-primary text-primary">이 프레임 넣기</button>
            <button type="button" onClick={() => insert([0.3, 0.5, 0.7])}
              className="py-1.5 text-xs font-bold rounded-lg border border-outline text-on-surface">3장 넣기(0.3·0.5·0.7)</button>
          </div>
          <p className="text-[10px] text-on-surface-variant">계산 {Math.round(snap.data.elapsedMs)}ms · 모델 {snap.data.model}</p>
        </div>
      )}
    </div>
  )
}
