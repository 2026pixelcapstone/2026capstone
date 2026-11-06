import { useEffect, useRef, useState } from 'react'
import type { CanvasState } from '../../type/editor'
import { renderFrames } from '../../lib/editorExport'
import { checkConsistency, MIN_FRAMES, type FrameIssue } from '../../lib/animConsistency'
import { toast } from '../../store/toastStore'

interface Props {
  state: CanvasState
  activeFrameId: string | null
  onSelectFrame: (frameId: string) => void
}

interface Result {
  issues: FrameIssue[]
  frameIds: string[]
  images: ImageData[]
  w: number
  h: number
}

const THUMB = 96

/** 강조 칸을 빨간 테두리로 그린 썸네일 */
function Thumb({ img, marks, w, h }: { img: ImageData; marks: number[]; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const s = Math.max(1, Math.floor(THUMB / Math.max(w, h)))
    c.width = w * s
    c.height = h * s
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    tmp.getContext('2d')!.putImageData(img, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(tmp, 0, 0, w * s, h * s)
    ctx.strokeStyle = '#ff2d55'
    ctx.lineWidth = Math.max(1, s / 3)
    for (const p of marks) {
      const x = p % w
      const y = Math.floor(p / w)
      ctx.strokeRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1)
    }
  }, [img, marks, w, h])
  return <canvas ref={ref} className="rounded border border-outline bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] bg-[length:8px_8px]" style={{ imageRendering: 'pixelated', maxWidth: THUMB, maxHeight: THUMB }} />
}

/**
 * 에디터 AI 패널 — 애니메이션 일관성 검사(학습 없는 색 규칙, ml/scripts/fg_seqcheck.py와 같은 규칙·문턱).
 * 프레임마다 나머지 프레임과 비교해 '다른 프레임에 없는 색'·'색 비율이 튀는 프레임'을 찾아 칸을 표시. 그림은 고치지 않음(판단은 작가).
 */
export default function AnimCheckPanel({ state, activeFrameId, onSelectFrame }: Props) {
  const tags = state.animationTags ?? []
  const [range, setRange] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<Result | null>(null)
  const reqRef = useRef(0)

  const run = async () => {
    const tag = tags.find((t) => t.id === range)
    const from = tag ? tag.fromIndex : 0
    const to = tag ? tag.toIndex : state.frames.length - 1
    const frames = state.frames.slice(from, to + 1)
    if (frames.length < MIN_FRAMES) {
      toast.error(`프레임이 ${MIN_FRAMES}장 이상이어야 비교할 수 있습니다.`)
      return
    }
    const id = ++reqRef.current
    setLoading(true)
    try {
      const canvases = await renderFrames({ ...state, frames })
      const images = canvases.map((c) => c.getContext('2d')!.getImageData(0, 0, state.width, state.height))
      const issues = checkConsistency(images)
      if (id !== reqRef.current) return
      setRes({ issues, frameIds: frames.map((f) => f.id), images, w: state.width, h: state.height })
    } catch {
      if (id === reqRef.current) toast.error('검사하지 못했습니다.')
    } finally {
      if (id === reqRef.current) setLoading(false)
    }
  }

  const flagged = res?.issues.filter((i) => i.flagged) ?? []

  return (
    <div className="p-3 rounded-lg bg-surface-container-low border border-outline space-y-3">
      <p className="text-[11px] text-on-surface-variant leading-relaxed">
        프레임마다 나머지 프레임과 색을 비교해 <b>튀는 프레임</b>을 찾습니다(색 규칙 검사 — 위치·크기 흔들림은 아직 못 잡음). 그림은 바꾸지 않습니다.
      </p>
      {tags.length > 0 && (
        <select value={range} onChange={(e) => setRange(e.target.value)}
          className="w-full text-xs p-1.5 rounded border bg-surface border-outline text-on-surface" aria-label="검사할 범위">
          <option value="all">전체 프레임</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.fromIndex + 1}~{t.toIndex + 1})</option>)}
        </select>
      )}
      <button type="button" onClick={run} disabled={loading}
        className="w-full py-1.5 text-xs font-bold rounded-lg text-white bg-primary disabled:opacity-50">
        {loading ? '검사 중…' : '일관성 검사'}
      </button>

      {res && (
        <div className="space-y-2" role="status">
          <p className="text-xs font-bold text-on-surface">
            {flagged.length === 0 ? `${res.issues.length}프레임 — 튀는 프레임 없음` : `${res.issues.length}프레임 중 ${flagged.length}개 확인 필요`}
          </p>
          {flagged.map((it) => {
            const fid = res.frameIds[it.index]
            const globalIdx = state.frames.findIndex((f) => f.id === fid)
            return (
              <button type="button" key={fid} onClick={() => onSelectFrame(fid)}
                className={`w-full flex gap-2 items-start p-2 rounded border text-left ${fid === activeFrameId ? 'border-primary' : 'border-outline'} hover:bg-surface`}>
                <Thumb img={res.images[it.index]} marks={it.marks} w={res.w} h={res.h} />
                <div className="text-[11px] text-on-surface space-y-0.5">
                  <div className="font-bold">프레임 {globalIdx + 1}</div>
                  {it.reasons.map((r) => <div key={r} className="text-on-surface-variant">• {r}</div>)}
                  <div className="text-[10px] text-on-surface-variant">빨간 칸 = 확인할 곳 · 눌러서 프레임으로 이동</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
