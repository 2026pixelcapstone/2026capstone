import { useRef, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { editorApi } from '../api/editorApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'

// ── 상수 ──────────────────────────────────────────────
const DRAW_TOOLS = [
  { id: 'pencil',    icon: 'edit',               label: 'Pencil (P)' },
  { id: 'eraser',    icon: 'ink_eraser',          label: 'Eraser (E)' },
  { id: 'fill',      icon: 'format_color_fill',   label: 'Fill (G)' },
  { id: 'eyedrop',   icon: 'colorize',            label: 'Eyedropper (I)' },
]
const SELECT_TOOLS = [
  { id: 'marquee',   icon: 'select_all',          label: 'Marquee (M)' },
  { id: 'lasso',     icon: 'gesture',             label: 'Lasso (L)' },
  { id: 'move',      icon: 'open_with',           label: 'Move (V)' },
]
const SHAPE_TOOLS = [
  { id: 'line',      icon: 'horizontal_rule',     label: 'Line' },
  { id: 'rect',      icon: 'rectangle',           label: 'Rectangle (R)' },
  { id: 'ellipse',   icon: 'circle',              label: 'Ellipse (O)' },
]
const VIEW_TOOLS = [
  { id: 'zoom',      icon: 'search',              label: 'Zoom (Z)' },
  { id: 'pan',       icon: 'pan_tool',            label: 'Pan (Space)' },
]

const PALETTE_COLORS = [
  '#2f81f7','#818cf8','#c0c1ff','#e9ddff',
  '#191c1e','#494454','#7b7486','#f7f9fb',
  '#ffffff','#ba1a1a','#ffdad6','#16a34a',
  '#d1fae5','#f59e0b','#fef3c7','#06b6d4',
  '#cffafe','#ec4899','#fce7f3','#78350f',
  '#d97706',
]

const ZOOM_LEVELS = [1, 2, 4, 8, 10, 16, 20, 32, 64]
const CANVAS_PRESETS = ['8×8','16×16','32×32','64×64','128×128']

type MenuItem =
  | { separator: true }
  | { label: string; shortcut?: string; icon?: string; action?: () => void; disabled?: boolean }

// ── 컴포넌트 ──────────────────────────────────────────
export default function EditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const menuRef   = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isLoggedIn } = useAuthStore()

  const [activeTool, setActiveTool]   = useState('pencil')
  const [fgColor, setFgColor]         = useState('#2f81f7')
  const [hexInput, setHexInput]       = useState('#2f81f7')
  const [brushSize, setBrushSize]     = useState(1)
  const [opacity, setOpacity]         = useState(100)
  const [pixelPerfect, setPixelPerfect] = useState(true)
  const [zoomIdx, setZoomIdx]         = useState(6)           // x20
  const [cursorPos, setCursorPos]     = useState({ x: -1, y: -1 })
  const [canvasW, setCanvasW]         = useState(32)
  const [canvasH, setCanvasH]         = useState(32)
  const [customW, setCustomW]         = useState(32)
  const [customH, setCustomH]         = useState(32)
  const [activeLayer, setActiveLayer] = useState(2)
  const [layers, _setLayers]          = useState([
    { id: 1, name: 'Layer 1', visible: true, color: '#818cf8' },
    { id: 2, name: 'Layer 2', visible: true, color: '#2f81f7' },
    { id: 3, name: 'Layer 3', visible: true, color: null },
  ])
  const [showAnim, setShowAnim]       = useState(false)
  const [unsaved, setUnsaved]         = useState(false)
  const [openMenu, setOpenMenu]       = useState<string | null>(null)
  const [showGridLines, setShowGridLines] = useState(true)

  // ── 프로젝트 저장 관련 상태 ──────────────────────────
  const [projectId, setProjectId]       = useState<number | null>(null)
  const [projectTitle, setProjectTitle] = useState('Untitled Project')
  const [editingTitle, setEditingTitle] = useState(false)
  const [saving, setSaving]             = useState(false)

  const isDrawing = useRef(false)
  const zoom = ZOOM_LEVELS[zoomIdx]

  // 캔버스 초기화
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#e8e8e8'
    ctx.fillRect(0, 0, canvasW, canvasH)
  }, [canvasW, canvasH])

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenu])

  const getPixel = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.floor((e.clientX - rect.left) * (canvasW / rect.width)),
      y: Math.floor((e.clientY - rect.top)  * (canvasH / rect.height)),
    }
  }, [canvasW, canvasH])

  const drawPixel = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d')
    const pos = getPixel(e)
    if (!ctx || !pos) return
    const { x, y } = pos
    if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) return
    if (activeTool === 'pencil') {
      ctx.fillStyle = fgColor
      ctx.globalAlpha = opacity / 100
      ctx.fillRect(x, y, brushSize, brushSize)
      ctx.globalAlpha = 1
    } else if (activeTool === 'eraser') {
      ctx.clearRect(x, y, brushSize, brushSize)
      ctx.fillStyle = '#e8e8e8'
      ctx.fillRect(x, y, brushSize, brushSize)
    }
    setUnsaved(true)
  }, [activeTool, fgColor, brushSize, opacity, canvasW, canvasH, getPixel])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPixel(e)
    if (pos) setCursorPos(pos)
    if (isDrawing.current) drawPixel(e)
  }

  const applyCanvasSize = (w: number, h: number) => {
    setCanvasW(w); setCanvasH(h)
    setOpenMenu(null)
  }

  // ── URL 파라미터로 프로젝트 불러오기 ──────────────
  useEffect(() => {
    const id = searchParams.get('projectId')
    if (!id || !isLoggedIn) return
    const numId = Number(id)
    if (isNaN(numId)) return
    editorApi.getProject(numId).then(res => {
      const proj = res.data.data
      setProjectId(proj.projectId)
      setProjectTitle(proj.title)
      setCanvasW(proj.width)
      setCanvasH(proj.height)
      setCustomW(proj.width)
      setCustomH(proj.height)
      // 첫 번째 레이어의 pixelData 또는 fileUrl로 캔버스 복원
      const firstLayer = proj.layers?.[0]
      const imageSrc = firstLayer?.pixelData ?? firstLayer?.fileUrl ?? null
      if (imageSrc) {
        const img = new Image()
        img.onload = () => {
          requestAnimationFrame(() => {
            const ctx = canvasRef.current?.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, proj.width, proj.height)
              ctx.drawImage(img, 0, 0)
            }
          })
        }
        img.src = imageSrc
      }
      setUnsaved(false)
    }).catch(() => toast.error('프로젝트를 불러오지 못했습니다.'))
  }, [searchParams, isLoggedIn])

  // ── 저장 ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); return }
    const canvas = canvasRef.current
    if (!canvas) return
    const pixelData = canvas.toDataURL('image/png')
    setSaving(true)
    try {
      let pid = projectId
      if (!pid) {
        // 새 프로젝트 생성
        const res = await editorApi.createProject({
          title: projectTitle,
          width: canvasW,
          height: canvasH,
        })
        pid = res.data.data.projectId
        setProjectId(pid)
      } else {
        // 제목 업데이트
        await editorApi.updateProject(pid, { title: projectTitle })
      }
      // 레이어(캔버스 전체) 저장
      await editorApi.saveLayers(pid, [{
        layerId: null,
        name: 'Layer 1',
        layerOrder: 0,
        blendMode: 'NORMAL',
        isLocked: false,
        isVisible: true,
        opacity: 1.0,
        pixelData,
      }])
      setUnsaved(false)
      toast.success('저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }, [isLoggedIn, projectId, projectTitle, canvasW, canvasH])

  // ── Ctrl+S 단축키 ────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave])

  // ── PNG 내보내기 ──────────────────────────────────
  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${projectTitle.replace(/\s+/g, '_')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [projectTitle])

  // ── 새 프로젝트 ───────────────────────────────────
  const handleNewProject = useCallback(() => {
    if (unsaved && !confirm('저장되지 않은 변경사항이 있습니다. 계속하시겠습니까?')) return
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, canvasW, canvasH) }
    setProjectId(null)
    setProjectTitle('Untitled Project')
    setUnsaved(false)
    // URL에 남은 projectId 쿼리 파라미터 제거
    setSearchParams({}, { replace: true })
  }, [unsaved, canvasW, canvasH, setSearchParams])

  // HEX 입력 → 색상 반영
  const applyHex = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) setFgColor(hexInput)
  }

  // RGB 파싱
  const hexToRgb = (hex: string) => ({
    r: parseInt(hex.slice(1,3),16),
    g: parseInt(hex.slice(3,5),16),
    b: parseInt(hex.slice(5,7),16),
  })
  const rgb = hexToRgb(fgColor)

  // 툴 버튼 공통 스타일
  const toolBtn = (id: string) => ({
    background: activeTool === id ? 'rgba(47,129,247,0.15)' : 'transparent',
    color: activeTool === id ? '#2f81f7' : '#7d8590',
  })

  // ── 메뉴 정의 (actions can reference state) ──
  const MENU_DEFS: { id: string; label: string; items: MenuItem[] }[] = [
    {
      id: 'file', label: 'File',
      items: [
        { label: 'New Project',        icon: 'add',           shortcut: 'Ctrl+N', action: () => { handleNewProject(); setOpenMenu(null) } },
        { label: 'Open Project…',      icon: 'folder_open',   shortcut: 'Ctrl+O' },
        { separator: true },
        { label: 'Save',               icon: 'save',          shortcut: 'Ctrl+S', action: () => { handleSave(); setOpenMenu(null) } },
        { label: 'Save As…',           icon: 'save_as',       shortcut: 'Ctrl+Shift+S' },
        { separator: true },
        { label: 'Export as PNG',      icon: 'image',         action: () => { handleExportPNG(); setOpenMenu(null) } },
        { label: 'Export Spritesheet', icon: 'grid_on' },
        { label: 'Download .pixhub',   icon: 'download' },
        { separator: true },
        { label: 'Back to Main',       icon: 'arrow_back', action: () => { window.location.href = '/' } },
      ],
    },
    {
      id: 'edit', label: 'Edit',
      items: [
        { label: 'Undo',       icon: 'undo',        shortcut: 'Ctrl+Z' },
        { label: 'Redo',       icon: 'redo',        shortcut: 'Ctrl+Y' },
        { separator: true },
        { label: 'Cut',        icon: 'content_cut',  shortcut: 'Ctrl+X' },
        { label: 'Copy',       icon: 'content_copy', shortcut: 'Ctrl+C' },
        { label: 'Paste',      icon: 'content_paste',shortcut: 'Ctrl+V' },
        { separator: true },
        { label: 'Select All', icon: 'select_all',   shortcut: 'Ctrl+A' },
        { label: 'Deselect',   icon: 'deselect',     shortcut: 'Ctrl+D' },
      ],
    },
    {
      id: 'image', label: 'Image',
      items: [
        { label: 'Canvas Size…',     icon: 'crop',      action: () => {} },
        ...CANVAS_PRESETS.map(p => ({
          label: p,
          action: () => {
            const [w, h] = p.split('×').map(Number)
            applyCanvasSize(w, h)
          },
        })),
        { separator: true },
        { label: 'Flip Horizontal',  icon: 'flip' },
        { label: 'Flip Vertical',    icon: 'flip', },
        { label: 'Rotate 90° CW',    icon: 'rotate_right' },
      ],
    },
    {
      id: 'view', label: 'View',
      items: [
        { label: 'Zoom In',    icon: 'zoom_in',   shortcut: '+', action: () => { setZoomIdx(i => Math.min(ZOOM_LEVELS.length-1, i+1)); setOpenMenu(null) } },
        { label: 'Zoom Out',   icon: 'zoom_out',  shortcut: '-', action: () => { setZoomIdx(i => Math.max(0, i-1)); setOpenMenu(null) } },
        { label: 'Fit Screen', icon: 'fit_screen',              action: () => { setZoomIdx(6); setOpenMenu(null) } },
        { label: '100%',       icon: 'crop_free',               action: () => { setZoomIdx(ZOOM_LEVELS.indexOf(1) >= 0 ? ZOOM_LEVELS.indexOf(1) : 0); setOpenMenu(null) } },
        { separator: true },
        { label: showGridLines ? 'Hide Grid' : 'Show Grid', icon: 'grid_on', action: () => { setShowGridLines(v => !v); setOpenMenu(null) } },
      ],
    },
    {
      id: 'layer', label: 'Layer',
      items: [
        { label: 'Add Layer',    icon: 'add' },
        { label: 'Delete Layer', icon: 'delete' },
        { label: 'Duplicate',    icon: 'copy_all' },
        { separator: true },
        { label: 'Move Up',      icon: 'arrow_upward' },
        { label: 'Move Down',    icon: 'arrow_downward' },
        { separator: true },
        { label: 'Merge Visible',icon: 'merge' },
        { label: 'Flatten',      icon: 'layers_clear' },
      ],
    },
  ]

  return (
    // 에디터는 뷰포트 전체 사용 (MainLayout의 pt-14 무시)
    <div className="fixed inset-0 top-0 flex flex-col" style={{ background: '#0d1117', color: '#e6edf3', zIndex: 60 }}>

      {/* ── TOP BAR (Photoshop 스타일 메뉴 툴바) ─────── */}
      <header className="h-10 flex items-center flex-shrink-0 border-b select-none"
        style={{ background: '#161b22', borderColor: '#30363d' }}>

        {/* 좌: 로고 + 메뉴바 */}
        <div ref={menuRef} className="flex items-center h-full">
          {/* 로고 */}
          <a href="/" className="flex items-center gap-1.5 font-bold text-sm px-4 h-full hover:bg-[#21262d] transition-colors"
            style={{ color: '#2f81f7' }}>
            <span className="material-symbols-outlined text-base">grid_view</span>
            PixelHub
          </a>

          <div className="w-px h-5 mx-1" style={{ background: '#30363d' }} />

          {/* 메뉴 항목들 */}
          {MENU_DEFS.map(menu => (
            <div key={menu.id} className="relative h-full flex items-center">
              <button
                onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                className="px-3 h-full text-sm transition-colors"
                style={{
                  color: openMenu === menu.id ? '#e6edf3' : '#c9d1d9',
                  background: openMenu === menu.id ? '#21262d' : 'transparent',
                }}>
                {menu.label}
              </button>

              {openMenu === menu.id && (
                <div className="absolute top-full left-0 rounded-b-lg border shadow-2xl py-1 z-50 min-w-[220px]"
                  style={{ background: '#21262d', borderColor: '#30363d', borderTopColor: 'transparent' }}>
                  {menu.items.map((item, idx) => {
                    if ('separator' in item) {
                      return <div key={idx} className="my-1 border-t" style={{ borderColor: '#30363d' }} />
                    }
                    return (
                      <button key={idx}
                        onClick={item.action ?? (() => setOpenMenu(null))}
                        disabled={item.disabled}
                        className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-left transition-colors hover:bg-[#292f38] disabled:opacity-40 disabled:cursor-default">
                        {item.icon && (
                          <span className="material-symbols-outlined text-sm w-4 flex-shrink-0"
                            style={{ color: '#7d8590' }}>{item.icon}</span>
                        )}
                        <span className="flex-1" style={{ color: '#e6edf3' }}>{item.label}</span>
                        {item.shortcut && (
                          <span className="text-xs ml-4" style={{ color: '#7d8590' }}>{item.shortcut}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 우: 파일명 + 저장 + 공유 */}
        <div className="ml-auto flex items-center gap-2 pr-3">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ color: '#7d8590' }}>description</span>
            {editingTitle ? (
              <input
                autoFocus
                type="text"
                value={projectTitle}
                onChange={e => setProjectTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTitle(false) }}
                className="text-sm font-bold rounded px-1 outline-none"
                style={{ background: '#1c2128', border: '1px solid #2f81f7', color: '#e6edf3', width: 160 }}
              />
            ) : (
              <span
                className="text-sm font-bold cursor-pointer hover:text-white transition-colors"
                title="클릭하여 제목 수정"
                onClick={() => setEditingTitle(true)}
              >{projectTitle}</span>
            )}
            {unsaved && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="미저장 변경사항" />}
          </div>
          <div className="w-px h-5 mx-1" style={{ background: '#30363d' }} />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1 text-sm font-bold rounded-lg transition-all hover:bg-[#1c2128] disabled:opacity-50"
            style={{ color: saving ? '#2f81f7' : '#7d8590' }}>
            <span className="material-symbols-outlined text-base">{saving ? 'hourglass_empty' : 'save'}</span>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#2f81f7', color: '#fff', boxShadow: '0 2px 8px rgba(47,129,247,0.3)' }}>
            <span className="material-symbols-outlined text-base">share</span>Share
          </button>
        </div>
      </header>

      {/* ── EDITOR BODY ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── 좌측 툴바 ── */}
        <aside className="flex flex-col items-center py-3 gap-1 flex-shrink-0 border-r"
          style={{ width: 84, background: '#161b22', borderColor: '#30363d' }}>

          {/* 그리기 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: '#30363d' }}>
            {DRAW_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 선택 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: '#30363d' }}>
            {SELECT_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 도형 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: '#30363d' }}>
            {SHAPE_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 뷰 도구 (하단 고정) */}
          <div className="flex flex-col items-center gap-1 w-full px-2 mt-auto">
            {VIEW_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── 캔버스 영역 ─────────────────────────────── */}
        {/* 바깥 배경: 캔버스보다 약간 진한 중간 회색 (체커보드) */}
        <main className="flex-1 flex items-center justify-center overflow-hidden relative"
          style={{
            backgroundColor: '#767676',
            backgroundImage: [
              'linear-gradient(45deg,#848484 25%,transparent 25%)',
              'linear-gradient(-45deg,#848484 25%,transparent 25%)',
              'linear-gradient(45deg,transparent 75%,#848484 75%)',
              'linear-gradient(-45deg,transparent 75%,#848484 75%)',
            ].join(','),
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
          }}>

          {/* 캔버스 래퍼 — backgroundColor로 연회색 보장 */}
          <div className="relative shadow-2xl"
            style={{ width: canvasW * zoom, height: canvasH * zoom, backgroundColor: '#e8e8e8' }}>
            {/* 픽셀 그리드 오버레이 */}
            {showGridLines && zoom >= 8 && (
              <div className="absolute inset-0 pointer-events-none z-10"
                style={{
                  backgroundImage: 'linear-gradient(rgba(80,80,80,0.25) 1px,transparent 1px),linear-gradient(90deg,rgba(80,80,80,0.25) 1px,transparent 1px)',
                  backgroundSize: `${zoom}px ${zoom}px`,
                }} />
            )}
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              style={{
                width: canvasW * zoom,
                height: canvasH * zoom,
                imageRendering: 'pixelated',
                cursor: 'crosshair',
                display: 'block',
                backgroundColor: '#e8e8e8',   // 캔버스 배경: 연회색
              }}
              onMouseDown={e => { isDrawing.current = true; drawPixel(e) }}
              onMouseMove={handleMouseMove}
              onMouseUp={() => { isDrawing.current = false }}
              onMouseLeave={() => { isDrawing.current = false; setCursorPos({ x: -1, y: -1 }) }}
            />
          </div>

          {/* 줌 컨트롤 (하단 중앙 플로팅) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl px-3 py-1.5 shadow-lg border"
            style={{ background: '#21262d', borderColor: '#30363d' }}>
            <button onClick={() => setZoomIdx(i => Math.max(0, i-1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[#292f38]"
              style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-sm">remove</span>
            </button>
            <span className="text-xs font-bold w-12 text-center">x{zoom}</span>
            <button onClick={() => setZoomIdx(i => Math.min(ZOOM_LEVELS.length-1, i+1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[#292f38]"
              style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
          </div>

          {/* 커서 위치 (우하단 플로팅) */}
          <div className="absolute bottom-4 right-4 rounded-lg px-3 py-1.5 shadow border text-xs font-bold"
            style={{ background: 'rgba(33,38,45,0.9)', borderColor: '#30363d', color: '#7d8590' }}>
            {cursorPos.x >= 0 ? `x: ${cursorPos.x}  y: ${cursorPos.y}` : 'x: —  y: —'}
          </div>
        </main>

        {/* ── 애니메이션 패널 ── */}
        <div className="flex flex-col flex-shrink-0 border-l"
          style={{ width: showAnim ? 160 : 36, background: '#161b22', borderColor: '#30363d', transition: 'width 0.2s' }}>
          {/* 토글 버튼 */}
          <button onClick={() => setShowAnim(v => !v)}
            className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#21262d]"
            style={{ color: showAnim ? '#2f81f7' : '#7d8590' }}
            title="Animation">
            <span className="material-symbols-outlined text-xl">animation</span>
          </button>
          {showAnim && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest border-b flex items-center justify-between"
                style={{ color: '#7d8590', borderColor: '#30363d' }}>
                <span>Anim</span>
                <span className="text-[10px]">1 frame</span>
              </div>
              {/* 프레임 목록 */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                <div className="rounded-lg border-2 p-1 cursor-pointer"
                  style={{ borderColor: '#2f81f7', background: '#1c2128' }}>
                  <div className="aspect-square checkerboard rounded" style={{ background: '#e8e8e8' }} />
                  <div className="text-center text-[10px] mt-1 font-bold" style={{ color: '#2f81f7' }}>1</div>
                </div>
                <button className="w-full aspect-square rounded-lg border-2 border-dashed flex items-center justify-center transition-colors hover:bg-[#21262d]"
                  style={{ borderColor: '#30363d', color: '#7d8590' }}>
                  <span className="material-symbols-outlined text-lg">add</span>
                </button>
              </div>
              {/* 재생 컨트롤 */}
              <div className="flex items-center justify-center gap-1 p-2 border-t" style={{ borderColor: '#30363d' }}>
                {['skip_previous','play_arrow','skip_next'].map(icon => (
                  <button key={icon}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[#21262d]"
                    style={{ color: '#7d8590' }}>
                    <span className="material-symbols-outlined text-lg">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 우측 패널 ──────── */}
        <aside className="flex flex-col flex-shrink-0 border-l overflow-y-auto"
          style={{ width: 300, background: '#161b22', borderColor: '#30363d',
            scrollbarWidth: 'thin', scrollbarColor: '#21262d transparent' }}>

          {/* 색상 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: '#30363d' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#7d8590' }}>Color</div>
            {/* FG / BG 색상 */}
            <div className="flex items-center gap-4 mb-4 px-1">
              <div className="relative">
                <div className="w-12 h-12 rounded-lg border-2 cursor-pointer shadow-sm"
                  style={{ background: fgColor, borderColor: '#30363d' }} title="Foreground" />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg border-2 shadow-sm"
                  style={{ background: '#161b22', borderColor: '#30363d' }} title="Background" />
              </div>
              <div className="flex-1">
                <div className="text-xs mb-1" style={{ color: '#7d8590' }}>HEX</div>
                <input type="text" value={hexInput}
                  onChange={e => setHexInput(e.target.value)}
                  onBlur={applyHex}
                  onKeyDown={e => e.key === 'Enter' && applyHex()}
                  className="w-full text-sm font-bold rounded-lg px-2 py-1.5 outline-none"
                  style={{ background: '#1c2128', border: 'none', color: '#e6edf3' }} />
              </div>
            </div>
            {/* RGB 슬라이더 */}
            <div className="space-y-2 px-1">
              {[
                { ch: 'R', val: rgb.r, color: '#ef4444', accent: 'accent-red-500' },
                { ch: 'G', val: rgb.g, color: '#22c55e', accent: 'accent-emerald-500' },
                { ch: 'B', val: rgb.b, color: '#3b82f6', accent: 'accent-blue-500' },
              ].map(({ ch, val, color: col, accent }) => (
                <div key={ch} className="flex items-center gap-2">
                  <span className="text-xs font-bold w-3 flex-shrink-0" style={{ color: col }}>{ch}</span>
                  <input type="range" min={0} max={255} value={val}
                    className={`flex-1 h-1.5 cursor-pointer ${accent}`} readOnly />
                  <span className="text-xs font-bold w-7 text-right" style={{ color: '#7d8590' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 팔레트 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: '#30363d' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7d8590' }}>Palette</div>
              <div className="flex gap-1">
                {[['add','색상 추가'],['upload','팔레트 가져오기']].map(([icon,tip]) => (
                  <button key={icon} title={tip}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[#21262d]"
                    style={{ color: '#7d8590' }}>
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 px-1">
              {PALETTE_COLORS.map(c => (
                <button key={c} onClick={() => { setFgColor(c); setHexInput(c) }}
                  className="w-8 h-8 rounded cursor-pointer transition-all border-2 hover:scale-110"
                  style={{ background: c, borderColor: fgColor === c ? '#e6edf3' : 'transparent' }} />
              ))}
            </div>
            <button className="mt-3 text-xs font-bold hover:underline px-1"
              style={{ color: '#2f81f7' }}>Browse Lospec palettes…</button>
          </div>

          {/* 툴 옵션 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: '#30363d' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#7d8590' }}>Tool Options</div>
            <div className="space-y-4 px-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: '#7d8590' }}>Brush Size</span>
                  <span className="text-sm font-bold">{brushSize}px</span>
                </div>
                <input type="range" min={1} max={16} value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer accent-[#2f81f7]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: '#7d8590' }}>Opacity</span>
                  <span className="text-sm font-bold">{opacity}%</span>
                </div>
                <input type="range" min={0} max={100} value={opacity}
                  onChange={e => setOpacity(Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer accent-[#2f81f7]" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#7d8590' }}>Pixel Perfect</span>
                <button onClick={() => setPixelPerfect(v => !v)}
                  className="w-11 h-6 rounded-full relative transition-all flex-shrink-0"
                  style={{ background: pixelPerfect ? '#2f81f7' : '#30363d' }}>
                  <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ left: pixelPerfect ? 'calc(100% - 22px)' : '2px' }} />
                </button>
              </div>
            </div>
          </div>

          {/* 캔버스 크기 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: '#30363d' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#7d8590' }}>Canvas Size</div>
            <div className="px-1 space-y-2">
              <div className="grid grid-cols-3 gap-1">
                {CANVAS_PRESETS.map(p => {
                  const [w, h] = p.split('×').map(Number)
                  const active = canvasW === w && canvasH === h
                  return (
                    <button key={p} onClick={() => applyCanvasSize(w, h)}
                      className="py-1 text-xs rounded-lg font-bold transition-all border"
                      style={{
                        background: active ? 'rgba(47,129,247,0.15)' : '#1c2128',
                        borderColor: active ? '#2f81f7' : '#30363d',
                        color: active ? '#2f81f7' : '#7d8590',
                      }}>{p}</button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <input type="number" value={customW} min={1} max={512}
                  onChange={e => setCustomW(Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded text-xs outline-none text-center font-bold"
                  style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }} />
                <span className="text-xs" style={{ color: '#7d8590' }}>×</span>
                <input type="number" value={customH} min={1} max={512}
                  onChange={e => setCustomH(Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded text-xs outline-none text-center font-bold"
                  style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }} />
                <button onClick={() => applyCanvasSize(customW, customH)}
                  className="flex-1 py-1 rounded text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: '#2f81f7', color: '#fff' }}>Apply</button>
              </div>
            </div>
          </div>

          {/* 레이어 섹션 */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7d8590' }}>Layers</div>
              <div className="flex gap-1">
                {[['add','레이어 추가'],['delete','레이어 삭제']].map(([icon,tip]) => (
                  <button key={icon} title={tip}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[#21262d]"
                    style={{ color: '#7d8590' }}>
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-0.5">
              {[...layers].reverse().map(layer => (
                <div key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm"
                  style={{
                    background: activeLayer === layer.id ? 'rgba(47,129,247,0.1)' : 'transparent',
                    color: activeLayer === layer.id ? '#2f81f7' : '#7d8590',
                    fontWeight: activeLayer === layer.id ? 700 : 400,
                  }}>
                  <span className="material-symbols-outlined text-sm"
                    style={{ opacity: layer.visible ? 1 : 0.4 }}>
                    visibility
                  </span>
                  <div className="w-8 h-8 rounded border flex-shrink-0 checkerboard"
                    style={{
                      background: layer.color ?? undefined,
                      borderColor: '#30363d',
                    }} />
                  <span className="text-sm truncate flex-1">{layer.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ── 하단 상태바 ──────────── */}
      <footer className="flex items-center gap-6 px-5 flex-shrink-0 border-t text-sm font-bold"
        style={{ height: 42, background: '#161b22', borderColor: '#30363d', color: '#7d8590' }}>
        <span>Canvas: {canvasW} × {canvasH}</span>
        <span className="w-px h-4" style={{ background: '#30363d' }} />
        <span>Zoom: {zoom * 100}%</span>
        <span className="w-px h-4" style={{ background: '#30363d' }} />
        <span>{cursorPos.x >= 0 ? `Cursor: ${cursorPos.x}, ${cursorPos.y}` : 'Cursor: —'}</span>
        <span className="w-px h-4" style={{ background: '#30363d' }} />
        <span>Tool: {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}</span>
        <span className="w-px h-4" style={{ background: '#30363d' }} />
        <span>Active: {layers.find(l => l.id === activeLayer)?.name}</span>
        <div className="ml-auto flex items-center gap-4">
          <span>{layers.length} layers</span>
          <span className="w-px h-4" style={{ background: '#30363d' }} />
          {unsaved
            ? <span style={{ color: '#f59e0b' }}>● Unsaved</span>
            : <span style={{ color: '#3fb950' }}>● Saved</span>}
        </div>
      </footer>
    </div>
  )
}
