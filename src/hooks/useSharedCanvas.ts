import { useCallback, useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import { canvasApi, type CanvasEvent, type CanvasSnapshot } from '../api/canvasApi'
import { decodeBoard, drawBoard, drawPixel } from '../lib/canvasBoard'
import { getErrorCode, getErrorMessage } from '../lib/errorUtils'
import { toast } from '../store/toastStore'

// localStorage(zustand persist)의 accessToken — axios 인터셉터·채팅과 같은 출처
function getToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage')
    return raw ? (JSON.parse(raw)?.state?.accessToken ?? null) : null
  } catch {
    return null
  }
}

const WS_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/^http/, 'ws') + '/ws'

interface Meta {
  seasonId: number
  size: number
  palette: string[]
  seasonEndsAt: string
  cooldownSeconds: number
}

/**
 * 공동 캔버스 상태 + 실시간(C-3).
 * 첫 스냅샷은 연결과 무관하게 바로 받음(WebSocket이 안 붙어도 판은 보임 — CodeRabbit #126).
 * 로그인: /topic/canvas 구독 → 연결될 때마다 스냅샷을 다시 받고, 그동안 온 이벤트는 버퍼 → 스냅샷 도착 후 버퍼 중 스냅샷보다 새 것만 반영
 *         (버퍼에 REFRESH·다른 시즌 이벤트가 있었으면 받은 스냅샷이 이미 낡았을 수 있어 한 번 더 받음)
 *         → 이후 칸마다 '그 칸의 마지막 version'보다 큰 이벤트만 반영(늦게 온·중복 이벤트 무시). 재연결·REFRESH·시즌 바뀜이면 스냅샷 다시.
 * 비로그인: 스냅샷만(실시간 없음 — STOMP CONNECT가 로그인 필요), 새로고침 버튼으로 다시 받음.
 * 판은 ref(Uint8Array)에 두고 <canvas>에 직접 그림 — 칸이 바뀔 때마다 React 다시 그리기를 하지 않음.
 */
export function useSharedCanvas(loggedIn: boolean) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const board = useRef<Uint8Array | null>(null)
  const cellVer = useRef<Float64Array | null>(null)
  const buffer = useRef<CanvasEvent[] | null>([])   // null = 스냅샷 적용 끝(버퍼 안 씀)
  const metaRef = useRef<Meta | null>(null)
  const loadGen = useRef(0)
  const loadRef = useRef<() => Promise<void>>(async () => {})
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState(false)          // 마지막 스냅샷 요청 실패(판이 있어도 '다시 받기' 안내)
  const [live, setLive] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)   // Date.now() 기준 끝나는 시각
  const [placing, setPlacing] = useState(false)
  const [, setTick] = useState(0)                         // 칸 색 미리보기 등 값 갱신용

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    const m = metaRef.current
    if (ctx && board.current && m) drawBoard(ctx, board.current, m.palette, m.size)
  }, [])

  const applyPixel = useCallback((ev: CanvasEvent) => {
    const m = metaRef.current
    if (!m || !board.current || !cellVer.current || ev.x == null || ev.y == null || ev.color == null) return
    const i = ev.y * m.size + ev.x
    if (ev.version <= cellVer.current[i]) return
    cellVer.current[i] = ev.version
    board.current[i] = ev.color
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawPixel(ctx, ev.x, ev.y, m.palette[ev.color] ?? m.palette[0])
    setTick(t => t + 1)
  }, [])

  const load = useCallback(async () => {
    const gen = ++loadGen.current
    buffer.current = []
    try {
      const res = await canvasApi.getSnapshot()
      if (gen !== loadGen.current) return                 // 더 새 요청이 있음
      const s: CanvasSnapshot = res.data.data
      const m: Meta = { seasonId: s.seasonId, size: s.size, palette: s.palette, seasonEndsAt: s.seasonEndsAt, cooldownSeconds: s.cooldownSeconds }
      metaRef.current = m
      board.current = decodeBoard(s.board, s.size)
      cellVer.current = new Float64Array(s.size * s.size).fill(s.version)
      setMeta(m)
      setError(false)
      setCooldownUntil(s.cooldownRemainingMs > 0 ? Date.now() + s.cooldownRemainingMs : 0)
      const pending = buffer.current ?? []
      buffer.current = null
      redraw()
      if (pending.some(e => e.type === 'REFRESH' || e.seasonId !== s.seasonId)) { void loadRef.current(); return }   // 낡은 스냅샷일 수 있음
      pending.filter(e => e.type === 'PIXEL').forEach(applyPixel)
    } catch {
      if (gen !== loadGen.current) return
      buffer.current = null            // 버퍼를 풀어 이후 이벤트는 그대로 반영(판이 있으면 계속 보임)
      setError(true)
    }
  }, [applyPixel, redraw])
  useEffect(() => { loadRef.current = load }, [load])

  // 캔버스 요소가 (다시) 붙으면 그리기
  const attach = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el
    if (el) redraw()
  }, [redraw])

  // 첫 스냅샷 — 연결과 따로(로그인 여부와 무관)
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!loggedIn) {
      setLive(false)
      return
    }
    const token = getToken()
    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 4000,
      onConnect: () => {
        client.subscribe('/topic/canvas', frame => {
          try {
            const ev = JSON.parse(frame.body) as CanvasEvent
            if (buffer.current) { buffer.current.push(ev); return }      // 스냅샷 받는 중
            if (ev.type === 'REFRESH' || ev.seasonId !== metaRef.current?.seasonId) { load(); return }
            applyPixel(ev)
          } catch { /* 파싱 실패 무시 */ }
        })
        setLive(true)
        load()                                                          // 구독 다음에 스냅샷(사이에 온 칸은 버퍼로)
      },
      onWebSocketClose: () => setLive(false),
      onStompError: frame => console.error('[canvas] STOMP error:', frame.headers['message']),
    })
    client.activate()
    return () => { client.deactivate(); setLive(false) }
  }, [loggedIn, load, applyPixel])

  const place = useCallback(async (x: number, y: number, color: number) => {
    const m = metaRef.current
    if (!m || !board.current || placing) return
    if (board.current[y * m.size + x] === color) return               // 같은 색 다시 찍기는 막음(쿨다운 낭비)
    setPlacing(true)
    try {
      const r = (await canvasApi.place({ x, y, color })).data.data
      setCooldownUntil(Date.now() + r.cooldownRemainingMs)
      if (r.seasonId === m.seasonId) applyPixel({ type: 'PIXEL', seasonId: r.seasonId, x: r.x, y: r.y, color: r.color, version: r.version })
      else load()
    } catch (e) {
      const code = getErrorCode(e)
      if (code === 'CANVAS_COOLDOWN') { toast.error('아직 쿨다운 중이에요.'); load() }
      else if (code === 'CANVAS_NOT_READY') { toast.error('시즌을 준비하고 있어요. 잠시 후 다시 시도해 주세요.'); load() }
      else toast.error(getErrorMessage(e, '칸을 찍지 못했어요.'))
    } finally {
      setPlacing(false)
    }
  }, [placing, applyPixel, load])

  const colorAt = useCallback((x: number, y: number): number | null => {
    const m = metaRef.current
    return board.current && m ? board.current[y * m.size + x] : null
  }, [])

  return { attach, meta, error, live, cooldownUntil, placing, place, colorAt, reload: load }
}
