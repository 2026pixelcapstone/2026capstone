import { useRef, useState } from 'react'
import type { CanvasState } from '../../type/editor'
import { renderFrames } from '../../lib/editorExport'
import { checkTiming, MIN_FRAMES, type Step } from '../../lib/animTiming'
import { toast } from '../../store/toastStore'

interface Props {
  state: CanvasState
  activeFrameId: string | null
  onSelectFrame: (frameId: string) => void
  /** 거의 같은 두 프레임을 하나로(앞 프레임 길이 += 뒤 프레임 길이, 뒤 프레임 삭제) — 되돌리기 한 번 */
  onMerge: (keepId: string, dropId: string) => boolean
}

interface Result {
  steps: Step[]
  frameIds: string[]
  durations: number[]
  /** 점검한 순간의 상태(프레임 배열은 바뀔 때마다 새 배열 — 그림·순서·길이가 바뀌면 결과를 무효로, 리뷰 #142) */
  frames: CanvasState['frames']
  w: number
  h: number
}

/**
 * 에디터 AI 패널 — 타이밍 점검(학습 없는 규칙, lib/animTiming.ts). 속도는 작가가 정하고, 여기선 계산으로 확실한 것만 알려 줌:
 * 구간별 이동·바뀐 칸, 큰 점프(프레임 추가 후보), 거의 같은 프레임(합치고 길게).
 */
export default function AnimTimingPanel({ state, activeFrameId, onSelectFrame, onMerge }: Props) {
  const tags = state.animationTags ?? []
  const [range, setRange] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<Result | null>(null)
  const reqRef = useRef(0)
  const latest = useRef(state)
  latest.current = state
  const stale = !!res && (res.frames !== state.frames || res.w !== state.width || res.h !== state.height)

  const changeRange = (v: string) => {
    reqRef.current++                                     // 진행 중 점검도 버림
    setLoading(false)
    setRange(v)
    setRes(null)
  }

  const run = async () => {
    const tag = tags.find((t) => t.id === range)
    const from = tag ? tag.fromIndex : 0
    const to = tag ? tag.toIndex : state.frames.length - 1
    const frames = state.frames.slice(from, to + 1)
    if (frames.length < MIN_FRAMES) {
      toast.error(`프레임이 ${MIN_FRAMES}장 이상이어야 점검할 수 있습니다.`)
      return
    }
    const id = ++reqRef.current
    setLoading(true)
    try {
      const canvases = await renderFrames({ ...state, frames })
      const images = canvases.map((c) => c.getContext('2d')!.getImageData(0, 0, state.width, state.height))
      const durations = frames.map((f) => (f.duration && f.duration > 0 ? f.duration : 100))
      const steps = checkTiming(images, durations)
      if (id !== reqRef.current) return
      const now = latest.current
      if (now.frames !== state.frames || now.width !== state.width || now.height !== state.height) {
        toast.error('점검하는 동안 그림이 바뀌었습니다. 다시 점검해 주세요.')
        setRes(null)
        return
      }
      setRes({ steps, frameIds: frames.map((f) => f.id), durations, frames: state.frames, w: state.width, h: state.height })
    } catch {
      if (id === reqRef.current) toast.error('점검하지 못했습니다.')
    } finally {
      if (id === reqRef.current) setLoading(false)
    }
  }

  const num = (fid: string) => state.frames.findIndex((f) => f.id === fid) + 1
  /** 두 프레임이 같은 애니메이션 태그들에 속하는가(다르면 합치면 태그 범위가 어긋나므로 막음) */
  const sameTags = (a: string, b: string) => {
    const ia = state.frames.findIndex((f) => f.id === a)
    const ib = state.frames.findIndex((f) => f.id === b)
    return tags.every((t) => (t.fromIndex <= ia && ia <= t.toIndex) === (t.fromIndex <= ib && ib <= t.toIndex))
  }

  const merge = (keep: string, drop: string) => {
    if (stale) {
      toast.error('점검한 뒤 그림이 바뀌었습니다. 다시 점검해 주세요.')
      return
    }
    if (!sameTags(keep, drop)) {
      toast.error('두 프레임이 서로 다른 애니메이션 태그에 걸쳐 있어 합칠 수 없습니다.')
      return
    }
    if (onMerge(keep, drop)) {
      toast.success('합쳤습니다. 되돌리기(Ctrl+Z)로 되돌릴 수 있어요.')
      setRes(null)                                       // 프레임이 바뀌었으니 다시 점검
    }
  }

  const avgFps = res ? Math.round(1000 / (res.durations.reduce((s, d) => s + d, 0) / res.durations.length)) : 0
  const jumps = res?.steps.filter((s) => s.jump) ?? []
  const sames = res?.steps.filter((s) => s.same && !s.wrap) ?? []

  return (
    <div className="p-3 rounded-lg bg-surface-container-low border border-outline space-y-3">
      <p className="text-[11px] text-on-surface-variant leading-relaxed">
        프레임 사이 움직임을 계산해 <b>큰 점프</b>(프레임을 더 넣으면 부드러워질 곳)와 <b>거의 같은 프레임</b>(합치고 길게 해도 같은 곳)을 알려 줍니다.
        재생 속도는 작가가 정하는 부분이라 추천 FPS는 내지 않습니다(작가 GIF 분석에서 움직임과 속도 사이 규칙이 뚜렷하지 않았음).
      </p>
      {tags.length > 0 && (
        <select value={range} onChange={(e) => changeRange(e.target.value)}
          className="w-full text-xs p-1.5 rounded border bg-surface border-outline text-on-surface" aria-label="점검할 범위">
          <option value="all">전체 프레임</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.fromIndex + 1}~{t.toIndex + 1})</option>)}
        </select>
      )}
      <button type="button" onClick={run} disabled={loading}
        className="w-full py-1.5 text-xs font-bold rounded-lg text-white bg-primary disabled:opacity-50">
        {loading ? '점검 중…' : '타이밍 점검'}
      </button>

      {res && stale && (
        <p className="text-[11px] text-on-surface-variant" role="status">점검한 뒤 그림·프레임이 바뀌었습니다. 다시 점검해 주세요.</p>
      )}

      {res && !stale && (
        <div className="space-y-2" role="status">
          <p className="text-xs font-bold text-on-surface">
            {res.frameIds.length}프레임 · 평균 {avgFps} FPS — 큰 점프 {jumps.length} · 거의 같은 프레임 {sames.length}
          </p>

          {jumps.map((s) => {
            const a = res.frameIds[s.from], b = res.frameIds[s.to]
            return (
              <button type="button" key={`j${s.from}`} onClick={() => onSelectFrame(b)}
                className={`w-full p-2 rounded border text-left text-[11px] ${b === activeFrameId ? 'border-primary' : 'border-outline'} hover:bg-surface`}>
                <div className="font-bold text-on-surface">큰 점프 · 프레임 {num(a)} → {num(b)}{s.wrap ? ' (반복 이음)' : ''}</div>
                <div className="text-on-surface-variant">이동 {s.move.toFixed(1)}칸 · 바뀐 칸 {(s.changed * 100).toFixed(0)}% — 사이에 프레임을 넣으면 부드러워집니다</div>
              </button>
            )
          })}

          {sames.map((s) => {
            const a = res.frameIds[s.from], b = res.frameIds[s.to]
            return (
              <div key={`s${s.from}`} className="p-2 rounded border border-outline text-[11px] space-y-1">
                <div className="font-bold text-on-surface">거의 같은 프레임 · {num(a)}·{num(b)}</div>
                <div className="text-on-surface-variant">바뀐 칸 {(s.changed * 100).toFixed(1)}% — 하나로 합치고 길이를 더하면({res.durations[s.from]}+{res.durations[s.to]}ms) 같은 움직임</div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => onSelectFrame(b)} className="px-2 py-0.5 rounded border border-outline hover:bg-surface">보기</button>
                  <button type="button" onClick={() => merge(a, b)} className="px-2 py-0.5 rounded border border-primary text-primary hover:bg-surface">합치기</button>
                </div>
              </div>
            )
          })}

          <details className="text-[11px] text-on-surface-variant">
            <summary className="cursor-pointer">구간별 숫자</summary>
            <ul className="mt-1 space-y-0.5 tabular-nums">
              {res.steps.map((s) => (
                <li key={`r${s.from}`}>
                  {num(res.frameIds[s.from])}→{num(res.frameIds[s.to])}: 이동 {s.move.toFixed(1)}칸 · 바뀐 칸 {(s.changed * 100).toFixed(0)}% · 초당 {s.perSec.toFixed(0)}칸
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}
