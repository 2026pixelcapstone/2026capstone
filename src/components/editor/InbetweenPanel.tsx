import { useEffect, useRef, useState } from 'react'
import type { CanvasState } from '../../type/editor'
import { aiApi } from '../../api/aiApi'
import { renderFrames } from '../../lib/editorExport'
import { toast } from '../../store/toastStore'
import { getErrorMessage } from '../../lib/errorUtils'

interface Props {
  state: CanvasState
  activeFrameId: string | null
  /** afterId 뒤에 레이어 하나짜리 프레임들을 순서대로 넣고 넣은 장수를 돌려줌(되돌리기 한 번) */
  onInsert: (afterId: string, items: { pixelData: string; name: string }[]) => number
}

interface Candidate {
  image: string // PNG base64
  model: string
  elapsedMs: number
}

const MAX_SIDE = 124 // 학습 데이터 상한(백엔드·ml과 같음)
const MAX_CANDIDATES = 4
const POLL_MS = 2000
const MODEL_LABEL: Record<string, string> = { v8_14000: '뼈대 조건', v7_12000: '기본', v6_14000: '이전 판' }

/**
 * 에디터 AI 패널 — 가운데 프레임 만들기(자체 생성 모델).
 * 앞·뒤 키프레임을 고르고 [가운데 프레임 만들기] → 작업 번호를 받아 2초마다 상태를 물음(1~2분) →
 * 후보가 쌓임(누를 때마다 하나, 최대 4개, 모델은 v8·v7·v6 차례) → 하나 골라 [프레임으로 넣기](앞 프레임 바로 뒤).
 * 넣은 뒤 작가가 고쳐 쓰는 '제안'. 앞·뒤를 바꾸면 후보는 비움(다른 두 장의 결과라서).
 */
export default function InbetweenPanel({ state, activeFrameId, onInsert }: Props) {
  const idx = Math.max(0, state.frames.findIndex((f) => f.id === activeFrameId))
  const [aIdx, setAIdx] = useState(idx)
  const [cIdx, setCIdx] = useState(Math.min(state.frames.length - 1, idx + 1))
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ status: 'sending' | 'queued' | 'running'; ahead: number; since: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [cands, setCands] = useState<Candidate[]>([])
  const [pick, setPick] = useState(0)
  const [pairIds, setPairIds] = useState<[string, string] | null>(null)
  const genRef = useRef(0) // 앞·뒤를 바꾸거나 패널이 사라지면 늘려서 진행 중 결과를 버림
  const viewRef = useRef<HTMLCanvasElement>(null)
  const sideRef = useRef<{ a: HTMLCanvasElement; c: HTMLCanvasElement } | null>(null)

  // 지금 프레임이 바뀌면 앞 = 지금, 뒤 = 다음으로 맞춤(만드는 중이면 그대로)
  useEffect(() => {
    if (busy) return
    setAIdx(idx)
    setCIdx(Math.min(state.frames.length - 1, idx + 1))
  }, [idx, state.frames.length]) // busy는 일부러 뺌(끝날 때 다시 맞추면 고른 앞·뒤가 바뀜)

  // 고른 앞·뒤가 후보를 만든 두 장과 다르면 후보를 비움
  const fa = state.frames[aIdx]
  const fc = state.frames[cIdx]
  useEffect(() => {
    if (!busy && pairIds && (pairIds[0] !== fa?.id || pairIds[1] !== fc?.id)) {
      setCands([])
      setPairIds(null)
    }
  }, [fa?.id, fc?.id, pairIds, busy])

  useEffect(() => () => { genRef.current++ }, []) // 사라지면 기다리던 결과 버림

  // 진행 중 경과 시간 표시
  useEffect(() => {
    if (!progress) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [progress])

  const tooBig = state.width > MAX_SIDE || state.height > MAX_SIDE

  const run = async () => {
    if (!fa || !fc || aIdx === cIdx) {
      toast.error('서로 다른 앞·뒤 프레임을 골라 주세요.')
      return
    }
    const gen = ++genRef.current
    const alive = () => gen === genRef.current
    const samePair = pairIds?.[0] === fa.id && pairIds?.[1] === fc.id
    const prev = samePair ? cands : []
    setBusy(true)
    setProgress({ status: 'sending', ahead: 0, since: Date.now() })
    setNow(Date.now())
    try {
      const [a, c] = await renderFrames({ ...state, frames: [fa, fc] })
      const b64 = (cv: HTMLCanvasElement) => cv.toDataURL('image/png').split(',')[1]
      const created = await aiApi.createInbetweenJob({ imageA: b64(a), imageC: b64(c), candidate: prev.length })
      if (!alive()) return
      const jobId = created.data.data.jobId
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS))
        if (!alive()) return
        const j = (await aiApi.getInbetweenJob(jobId)).data.data
        if (!alive()) return
        if (j.status === 'queued' || j.status === 'running') {
          const st = j.status
          setProgress((p) => ({ status: st, ahead: j.ahead ?? 0, since: p?.since ?? Date.now() }))
          continue
        }
        if (j.status === 'done' && j.image) {
          // 만드는 동안 앞·뒤 고르기는 잠겨 있으니 이 결과는 지금 고른 두 장의 것
          sideRef.current = { a, c }
          const next = [...prev, { image: j.image, model: j.model ?? '', elapsedMs: j.elapsedMs ?? 0 }].slice(-MAX_CANDIDATES)
          setPairIds([fa.id, fc.id])
          setCands(next)
          setPick(next.length - 1)
        } else {
          toast.error('가운데 프레임을 만들지 못했습니다. 다시 시도해 주세요.')
        }
        break
      }
    } catch (e) {
      if (alive()) toast.error(getErrorMessage(e, '가운데 프레임을 만들지 못했습니다.'))
    } finally {
      if (alive()) {
        setBusy(false)
        setProgress(null)
      }
    }
  }

  // 미리보기: 앞 | 고른 후보 | 뒤
  useEffect(() => {
    const cv = viewRef.current
    const side = sideRef.current
    const cand = cands[pick]
    if (!cv || !side || !cand) return
    const { width: w, height: h } = side.a
    const scale = Math.max(1, Math.floor(100 / Math.max(w, h)))
    cv.width = w * scale * 3 + 8
    cv.height = h * scale
    const ctx = cv.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(side.a, 0, 0, w * scale, h * scale)
    ctx.drawImage(side.c, w * scale * 2 + 8, 0, w * scale, h * scale)
    let live = true
    const im = new Image()
    im.onload = () => {
      if (!live) return
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(im, w * scale + 4, 0, w * scale, h * scale)
    }
    im.src = `data:image/png;base64,${cand.image}`
    return () => { live = false }
  }, [cands, pick])

  const insert = () => {
    const cand = cands[pick]
    if (!cand || !pairIds) return
    if (!state.frames.some((f) => f.id === pairIds[0])) {
      toast.error('앞 프레임이 지워져 넣을 수 없습니다. 다시 만들어 주세요.')
      return
    }
    const n = onInsert(pairIds[0], [{ pixelData: `data:image/png;base64,${cand.image}`, name: '가운데 프레임(AI 제안)' }])
    if (n) toast.success('앞 프레임 바로 뒤에 넣었습니다. 고쳐서 쓰세요.')
  }

  const frameOpts = state.frames.map((_, i) => <option key={i} value={i}>프레임 {i + 1}</option>)
  const sec = progress ? Math.max(0, Math.round((now - progress.since) / 1000)) : 0
  const hasCands = cands.length > 0 && pairIds?.[0] === fa?.id && pairIds?.[1] === fc?.id
  const label = state.frames.length < 2 ? '프레임이 2장 이상 필요'
    : tooBig ? `캔버스 긴 변 ${MAX_SIDE}칸 이하만`
      : hasCands ? '다른 후보 만들기' : '가운데 프레임 만들기'

  return (
    <div className="p-3 rounded-lg bg-surface-container-low border border-outline space-y-3">
      <p className="text-[11px] text-on-surface-variant leading-relaxed">
        두 키프레임 사이 <b>가운데 한 장</b>을 AI가 그려 <b>제안</b>합니다. 작은·중간 동작(특히 사람 몸)에 맞춰 학습했고,
        큰 동작은 잘 안 됩니다. 한 장에 1~2분 걸리고, 누를 때마다 다른 후보가 나옵니다.
      </p>
      <div className="flex items-center gap-2 text-xs text-on-surface">
        <select value={aIdx} onChange={(e) => setAIdx(Number(e.target.value))} aria-label="앞 키프레임" disabled={busy}
          className="flex-1 p-1.5 rounded border bg-surface border-outline">{frameOpts}</select>
        <span>→</span>
        <select value={cIdx} onChange={(e) => setCIdx(Number(e.target.value))} aria-label="뒤 키프레임" disabled={busy}
          className="flex-1 p-1.5 rounded border bg-surface border-outline">{frameOpts}</select>
      </div>
      <button type="button" onClick={run} disabled={busy || state.frames.length < 2 || tooBig}
        className="w-full py-1.5 text-xs font-bold rounded-lg text-white bg-primary disabled:opacity-50">
        {busy ? '만드는 중…' : label}
      </button>

      {progress && (
        <div className="space-y-1" role="status" aria-live="polite">
          <div className="h-1.5 rounded bg-surface overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(95, (sec / 120) * 100)}%` }} />
          </div>
          <p className="text-[11px] text-on-surface-variant">
            {progress.status === 'sending' ? '보내는 중…'
              : progress.status === 'queued' ? `차례를 기다리는 중(앞에 ${progress.ahead}개)…`
                : '그리는 중…'} {sec}초 · 보통 1~2분
          </p>
        </div>
      )}

      {hasCands && (
        <div className="space-y-2">
          <canvas ref={viewRef} className="w-full rounded border border-outline bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] bg-[length:8px_8px]" style={{ imageRendering: 'pixelated' }} />
          <div className="flex justify-between text-[10px] text-on-surface-variant"><span>앞</span><span>후보 {pick + 1}</span><span>뒤</span></div>
          <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="후보">
            {cands.map((cd, i) => (
              <button key={i} type="button" role="radio" aria-checked={i === pick} onClick={() => setPick(i)}
                className={`p-1 rounded border text-[10px] ${i === pick ? 'border-primary text-primary' : 'border-outline text-on-surface-variant'}`}>
                <img src={`data:image/png;base64,${cd.image}`} alt={`후보 ${i + 1}`} className="w-full aspect-square object-contain bg-surface" style={{ imageRendering: 'pixelated' }} />
                {i + 1}
              </button>
            ))}
          </div>
          <button type="button" onClick={insert} disabled={busy}
            className="w-full py-1.5 text-xs font-bold rounded-lg border border-primary text-primary disabled:opacity-50">프레임으로 넣기</button>
          <p className="text-[10px] text-on-surface-variant">
            모델 {MODEL_LABEL[cands[pick]?.model] ?? cands[pick]?.model} · {Math.round((cands[pick]?.elapsedMs ?? 0) / 1000)}초
            {cands.length >= MAX_CANDIDATES && ' · 후보는 최근 4개까지 보여요'}
          </p>
        </div>
      )}
    </div>
  )
}
