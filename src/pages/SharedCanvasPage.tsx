import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  SHARED_CANVAS_DEFAULT_ZOOM, SHARED_CANVAS_GRID_MIN_ZOOM, SHARED_CANVAS_SIZE, SHARED_CANVAS_ZOOMS,
} from '../constants/sharedCanvas'
import { useSharedCanvas } from '../hooks/useSharedCanvas'
import { useEmailGate } from '../hooks/useEmailGate'
import { useAuthStore } from '../store/authStore'

/** 남은 ms → m:ss */
function mmss(ms: number) {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * 공동 픽셀 캔버스(C-3) — 서버 저장 + 실시간(STOMP) + 서버 판정 쿨다운 + 분기 시즌.
 * <canvas> 하나(size×size)에 그린 뒤 CSS로 확대(pixelated). 판·실시간은 useSharedCanvas.
 */
export default function SharedCanvasPage() {
  const { isLoggedIn } = useAuthStore()
  const { blocked, message: gateMessage } = useEmailGate()
  const cv = useSharedCanvas(isLoggedIn)
  const size = cv.meta?.size ?? SHARED_CANVAS_SIZE
  const palette = cv.meta?.palette ?? []
  const [color, setColor] = useState(5)
  const [zoom, setZoom] = useState<number>(SHARED_CANVAS_DEFAULT_ZOOM)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // 쿨다운 표시용 시계(쿨다운 중일 때만)
  useEffect(() => {
    if (cv.cooldownUntil <= Date.now()) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [cv.cooldownUntil])
  const remaining = Math.max(0, cv.cooldownUntil - now)

  const canPlace = isLoggedIn && !blocked && remaining === 0 && !cv.placing && !!cv.meta

  /** 화면 좌표 → 칸 좌표. 실제 표시 크기(getBoundingClientRect) 기준이라 확대·스크롤과 무관 */
  const toCell = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * size)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * size)
    if (x < 0 || y < 0 || x >= size || y >= size) return null
    return { x, y }
  }

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = toCell(e)
    if (!cell || !canPlace) return
    cv.place(cell.x, cell.y, color)
  }

  /** 확대 단계 이동 — 이전 값 기준(함수형)이라 빠르게 연달아 눌러도 단계가 빠지지 않음 */
  const stepZoom = (dir: 1 | -1) => setZoom(z => {
    const i = SHARED_CANVAS_ZOOMS.indexOf(z as (typeof SHARED_CANVAS_ZOOMS)[number])
    return SHARED_CANVAS_ZOOMS[Math.min(SHARED_CANVAS_ZOOMS.length - 1, Math.max(0, i + dir))]
  })

  const zoomIndex = SHARED_CANVAS_ZOOMS.indexOf(zoom as (typeof SHARED_CANVAS_ZOOMS)[number])
  const display = size * zoom
  const hoverIdx = hover ? cv.colorAt(hover.x, hover.y) : null
  const hoverColor = hoverIdx != null ? palette[hoverIdx] : null
  const muted = { color: 'var(--color-on-surface-variant)' }
  const card = { background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }
  const btn = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }
  const seasonEnd = cv.meta ? new Date(cv.meta.seasonEndsAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : null

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 text-sm mb-2" style={muted}>
          <Link to="/community" className="hover:underline">커뮤니티</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span style={{ color: 'var(--color-on-surface)' }}>공동 픽셀 캔버스</span>
        </div>
        <h1 className="text-2xl font-bold">공동 픽셀 캔버스</h1>
        <p className="text-sm mt-1 mb-6" style={muted}>
          모두가 한 칸씩 더해 함께 완성하는 {size}×{size} 캔버스예요.
          {cv.meta && <> 한 칸을 찍으면 {cv.meta.cooldownSeconds >= 60 ? `${Math.round(cv.meta.cooldownSeconds / 60)}분` : `${cv.meta.cooldownSeconds}초`} 뒤에 다음 칸을 찍을 수 있어요. 이번 시즌은 {seasonEnd} 0시에 새로 시작해요.</>}
        </p>

        {cv.error && !cv.meta ? (
          <div className="rounded-xl border p-8 text-center" style={card}>
            <p className="text-sm mb-3">캔버스를 불러오지 못했어요.</p>
            <button type="button" onClick={() => cv.reload()} className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>다시 시도</button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* 캔버스 */}
            <div className="flex-1 min-w-0 w-full">
              <div className="overflow-auto rounded-xl border p-3 max-h-[75vh]"
                style={{ background: 'var(--color-surface-container-low)', borderColor: 'var(--color-outline)' }}>
                <div className="relative mx-auto" style={{ width: display, height: display }}>
                  <canvas ref={cv.attach} width={size} height={size}
                    onClick={onClick}
                    onMouseMove={e => setHover(toCell(e))}
                    onMouseLeave={() => setHover(null)}
                    aria-label={`공동 픽셀 캔버스 ${size}×${size}`}
                    className={`block ${canPlace ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
                    style={{ width: display, height: display, imageRendering: 'pixelated', background: '#ffffff' }} />
                  {!cv.meta && <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--color-surface-container-high)' }} />}
                  {zoom >= SHARED_CANVAS_GRID_MIN_ZOOM && (
                    <div className="absolute inset-0 pointer-events-none" style={{
                      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)',
                      backgroundSize: `${zoom}px ${zoom}px`,
                    }} />
                  )}
                  {hover && canPlace && palette[color] && (
                    <div className="absolute pointer-events-none" style={{
                      left: hover.x * zoom, top: hover.y * zoom, width: zoom, height: zoom,
                      background: palette[color], opacity: 0.6, outline: '1px solid rgba(0,0,0,0.6)',
                    }} />
                  )}
                </div>
              </div>
            </div>

            {/* 도구 */}
            <aside className="w-full lg:w-64 shrink-0 space-y-4">
              <div className="rounded-xl border p-4" style={card} aria-live="polite">
                {!isLoggedIn ? (
                  <>
                    <p className="text-sm mb-3">로그인하면 칸을 찍을 수 있어요.</p>
                    <div className="flex gap-2">
                      <Link to="/login" className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>로그인</Link>
                      <button type="button" onClick={() => cv.reload()} className="px-3 py-1.5 rounded-lg text-xs" style={btn}>새로고침</button>
                    </div>
                  </>
                ) : blocked ? (
                  <p className="text-sm" style={muted}>{gateMessage}</p>
                ) : remaining > 0 ? (
                  <p className="text-sm">다음 칸까지 <span className="font-mono font-bold">{mmss(remaining)}</span></p>
                ) : (
                  <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>지금 한 칸 찍을 수 있어요</p>
                )}
                {isLoggedIn && (
                  <p className="text-xs mt-2 flex items-center gap-1.5" style={muted}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: cv.live ? 'var(--color-success)' : 'var(--color-outline)' }} />
                    {cv.live ? '실시간 연결됨' : '연결 중…'}
                  </p>
                )}
              </div>

              <div className="rounded-xl border p-4" style={card}>
                <p className="text-sm font-bold mb-3">색</p>
                <div className="grid grid-cols-8 lg:grid-cols-4 gap-2">
                  {palette.map((c, i) => (
                    <button key={c} type="button" onClick={() => setColor(i)} aria-label={`색 ${c}`} aria-pressed={color === i}
                      className="aspect-square rounded-md border-2 transition-transform hover:scale-110"
                      style={{ background: c, borderColor: color === i ? 'var(--color-primary)' : 'var(--color-outline)' }} />
                  ))}
                </div>
                {palette[color] && (
                  <div className="flex items-center gap-2 mt-3 text-xs" style={muted}>
                    <span className="w-4 h-4 rounded border" style={{ background: palette[color], borderColor: 'var(--color-outline)' }} />
                    선택한 색 <span className="font-mono">{palette[color]}</span>
                  </div>
                )}
              </div>

              <div className="rounded-xl border p-4 space-y-3" style={card}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">확대</span>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="축소" disabled={zoomIndex <= 0}
                      onClick={() => stepZoom(-1)}
                      className="w-8 h-8 rounded-lg disabled:opacity-40" style={btn}>−</button>
                    <span className="w-12 text-center text-sm">{zoom}×</span>
                    <button type="button" aria-label="확대" disabled={zoomIndex >= SHARED_CANVAS_ZOOMS.length - 1}
                      onClick={() => stepZoom(1)}
                      className="w-8 h-8 rounded-lg disabled:opacity-40" style={btn}>+</button>
                  </div>
                </div>
                <div className="text-xs space-y-1" style={muted}>
                  <p>좌표 <span className="font-mono" style={{ color: 'var(--color-on-surface)' }}>{hover ? `(${hover.x}, ${hover.y})` : '—'}</span></p>
                  <p className="flex items-center gap-1.5">
                    칸 색
                    {hoverColor
                      ? <><span className="w-3 h-3 rounded-sm border inline-block" style={{ background: hoverColor, borderColor: 'var(--color-outline)' }} /><span className="font-mono">{hoverColor}</span></>
                      : ' —'}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
