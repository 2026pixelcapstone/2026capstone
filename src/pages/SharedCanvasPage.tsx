import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  SHARED_CANVAS_BG, SHARED_CANVAS_DEFAULT_ZOOM, SHARED_CANVAS_GRID_MIN_ZOOM,
  SHARED_CANVAS_PALETTE, SHARED_CANVAS_SIZE, SHARED_CANVAS_ZOOMS,
} from '../constants/sharedCanvas'

const SIZE = SHARED_CANVAS_SIZE

/**
 * 공동 픽셀 캔버스(C-3) — 화면 틀. 칸을 찍으면 내 화면에만 반영(저장·실시간·쿨다운은 후속).
 * 칸마다 DOM을 만들지 않고 <canvas> 하나(SIZE×SIZE)에 그린 뒤 CSS로 확대(pixelated) — 칸이 많아도 가벼움.
 */
export default function SharedCanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixels = useRef<string[]>(Array(SIZE * SIZE).fill(SHARED_CANVAS_BG))
  const [color, setColor] = useState<string>(SHARED_CANVAS_PALETTE[5])
  const [zoom, setZoom] = useState<number>(SHARED_CANVAS_DEFAULT_ZOOM)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [placed, setPlaced] = useState(0)   // 이번 방문에서 찍은 칸 수

  // 처음 한 번 배경 채우기
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = SHARED_CANVAS_BG
    ctx.fillRect(0, 0, SIZE, SIZE)
  }, [])

  /** 화면 좌표 → 칸 좌표. 실제 표시 크기(getBoundingClientRect) 기준이라 확대·스크롤과 무관 */
  const toCell = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE)
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null
    return { x, y }
  }

  const place = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = toCell(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (!cell || !ctx) return
    const i = cell.y * SIZE + cell.x
    if (pixels.current[i] === color) return
    pixels.current[i] = color
    ctx.fillStyle = color
    ctx.fillRect(cell.x, cell.y, 1, 1)
    setPlaced(n => n + 1)
  }

  /** 확대 단계 이동 — 이전 값 기준(함수형)이라 빠르게 연달아 눌러도 단계가 빠지지 않음 */
  const stepZoom = (dir: 1 | -1) => setZoom(z => {
    const i = SHARED_CANVAS_ZOOMS.indexOf(z as (typeof SHARED_CANVAS_ZOOMS)[number])
    return SHARED_CANVAS_ZOOMS[Math.min(SHARED_CANVAS_ZOOMS.length - 1, Math.max(0, i + dir))]
  })

  const zoomIndex = SHARED_CANVAS_ZOOMS.indexOf(zoom as (typeof SHARED_CANVAS_ZOOMS)[number])
  const display = SIZE * zoom
  const hoverColor = hover ? pixels.current[hover.y * SIZE + hover.x] : null
  const muted = { color: 'var(--color-on-surface-variant)' }
  const btn = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }

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
          색을 고르고 칸을 눌러 찍어 보세요. 모두가 한 칸씩 더해 함께 완성하는 {SIZE}×{SIZE} 캔버스예요.
        </p>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* 캔버스 */}
          <div className="flex-1 min-w-0 w-full">
            <div className="overflow-auto rounded-xl border p-3 max-h-[75vh]"
              style={{ background: 'var(--color-surface-container-low)', borderColor: 'var(--color-outline)' }}>
              <div className="relative mx-auto" style={{ width: display, height: display }}>
                <canvas ref={canvasRef} width={SIZE} height={SIZE}
                  onClick={place}
                  onMouseMove={e => setHover(toCell(e))}
                  onMouseLeave={() => setHover(null)}
                  aria-label={`공동 픽셀 캔버스 ${SIZE}×${SIZE}`}
                  className="block cursor-crosshair"
                  style={{ width: display, height: display, imageRendering: 'pixelated' }} />
                {/* 칸 경계선(확대했을 때만) */}
                {zoom >= SHARED_CANVAS_GRID_MIN_ZOOM && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)',
                    backgroundSize: `${zoom}px ${zoom}px`,
                  }} />
                )}
                {/* 마우스가 올라간 칸 미리보기 */}
                {hover && (
                  <div className="absolute pointer-events-none" style={{
                    left: hover.x * zoom, top: hover.y * zoom, width: zoom, height: zoom,
                    background: color, opacity: 0.6, outline: '1px solid rgba(0,0,0,0.6)',
                  }} />
                )}
              </div>
            </div>
          </div>

          {/* 도구 */}
          <aside className="w-full lg:w-64 shrink-0 space-y-4">
            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
              <p className="text-sm font-bold mb-3">색</p>
              <div className="grid grid-cols-8 lg:grid-cols-4 gap-2">
                {SHARED_CANVAS_PALETTE.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={`색 ${c}`} aria-pressed={color === c}
                    className="aspect-square rounded-md border-2 transition-transform hover:scale-110"
                    style={{ background: c, borderColor: color === c ? 'var(--color-primary)' : 'var(--color-outline)' }} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs" style={muted}>
                <span className="w-4 h-4 rounded border" style={{ background: color, borderColor: 'var(--color-outline)' }} />
                선택한 색 <span className="font-mono">{color}</span>
              </div>
            </div>

            <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
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
                <p>이번에 찍은 칸 <span style={{ color: 'var(--color-on-surface)' }}>{placed}</span></p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
