import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { galleryApi, type GalleryType, type Visibility, type TagResponse } from '../api/galleryApi'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'

const MAX_TAGS = 10
const MAX_IMAGES = 10

interface LocalImage {
  id: string
  file: File
  previewUrl: string
}

interface PixelFileInfo {
  name: string
  width: number
  height: number
  layerCount: number
  raw: object
}

function renderPixelData(canvas: HTMLCanvasElement, raw: object) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const d = raw as Record<string, unknown>
  const width = (d.width as number) || (d.canvasWidth as number) || 32
  const height = (d.height as number) || (d.canvasHeight as number) || 32
  const layers = (d.layers as Array<{ pixels?: Record<string, string>; visible?: boolean }>) || []
  const scale = Math.min(Math.floor(400 / Math.max(width, height)), 16) || 1
  canvas.width = width * scale
  canvas.height = height * scale
  ctx.imageSmoothingEnabled = false
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#1a1a1a' : '#222'
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  for (const layer of layers) {
    if (layer.visible === false) continue
    for (const [key, color] of Object.entries(layer.pixels ?? {})) {
      if (color && color !== 'transparent') {
        const [px, py] = key.split(',').map(Number)
        ctx.fillStyle = color
        ctx.fillRect(px * scale, py * scale, scale, scale)
      }
    }
  }
}

interface Props {
  type: GalleryType
  isOpen: boolean
  onClose: () => void
}

export default function GalleryCreateModal({ type, isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const isFree = type === 'FREE'

  // ── 폼 상태 ──
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [topTags, setTopTags] = useState<TagResponse[]>([])

  // ── 자유 갤러리: 이미지 ──
  const [images, setImages] = useState<LocalImage[]>([])
  const [draggingImg, setDraggingImg] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 전용 갤러리: JSON 파일 ──
  const [fileInfo, setFileInfo] = useState<PixelFileInfo | null>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const tagInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 모달 열릴 때 상태 초기화
  useEffect(() => {
    if (!isOpen) return
    setTitle(''); setDescription(''); setVisibility('PUBLIC')
    setSelectedTags([]); setTagInput(''); setSubmitting(false)
    setImages([]); setDraggingImg(false); setActiveIdx(0)
    setFileInfo(null); setDraggingFile(false); setParseError(null)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [isOpen])

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // 인기 태그
  useEffect(() => {
    if (!isOpen) return
    galleryApi.getTags().then(res => setTopTags(res.data.data)).catch(() => {})
  }, [isOpen])

  // 캔버스 렌더
  useEffect(() => {
    if (fileInfo && canvasRef.current) renderPixelData(canvasRef.current, fileInfo.raw)
  }, [fileInfo])

  // ── 이미지 추가 (FREE) ──
  const addImages = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    const remaining = MAX_IMAGES - images.length
    const toAdd = arr.slice(0, remaining).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setImages(prev => [...prev, ...toAdd])
    if (arr.length > remaining) toast.error(`이미지는 최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.`)
  }, [images.length])

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img) URL.revokeObjectURL(img.previewUrl)
      const next = prev.filter(i => i.id !== id)
      setActiveIdx(a => Math.min(a, Math.max(next.length - 1, 0)))
      return next
    })
  }

  // ── JSON 파일 처리 (DEDICATED) ──
  const processFile = useCallback((file: File) => {
    setParseError(null); setFileInfo(null)
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setParseError('.json 파일만 업로드할 수 있습니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as Record<string, unknown>
        const width = (raw.width as number) || (raw.canvasWidth as number) || 0
        const height = (raw.height as number) || (raw.canvasHeight as number) || 0
        if (!width || !height) { setParseError('파일 형식이 올바르지 않습니다. (width/height 누락)'); return }
        setFileInfo({ name: file.name, width, height, layerCount: ((raw.layers as unknown[]) || []).length, raw })
        setTitle(prev => prev || file.name.replace(/\.json$/, ''))
      } catch { setParseError('JSON 파싱에 실패했습니다.') }
    }
    reader.readAsText(file)
  }, [])

  // ── 태그 ──
  const addTag = (name: string) => {
    const t = name.trim().replace(/^#/, '')
    if (!t || selectedTags.includes(t) || selectedTags.length >= MAX_TAGS) return
    setSelectedTags(prev => [...prev, t]); setTagInput('')
  }
  const removeTag = (name: string) => setSelectedTags(prev => prev.filter(t => t !== name))
  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
    else if (e.key === 'Backspace' && tagInput === '' && selectedTags.length > 0) removeTag(selectedTags.at(-1)!)
  }

  // ── 제출 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (!isFree && !fileInfo) { toast.error('픽셀 파일을 업로드해주세요.'); return }
    setSubmitting(true)
    try {
      const res = await galleryApi.createPost({
        title: title.trim(),
        description: description.trim() || undefined,
        galleryType: type,
        visibility,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        ...(fileInfo ? { canvasWidth: fileInfo.width, canvasHeight: fileInfo.height } : {}),
      })
      toast.success('게시글이 등록되었습니다.')
      onClose()
      navigate(`/gallery/${res.data.data.postId}`)
    } catch (err) {
      toast.error(getErrorMessage(err, '게시글 등록에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const accentColor = isFree ? '#2f81f7' : '#f0883e'
  const accentBg = isFree ? 'rgba(47,129,247,0.12)' : 'rgba(240,136,62,0.12)'
  const accentBorder = isFree ? 'rgba(47,129,247,0.3)' : 'rgba(240,136,62,0.3)'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div
        className="relative flex flex-col rounded-2xl overflow-hidden w-full"
        style={{ maxWidth: 1100, height: '90vh', background: '#161b22', border: '1px solid #30363d' }}>

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #30363d' }}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-5 rounded-full" style={{ background: accentColor }} />
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
                {isFree ? '자유 갤러리' : '전용 갤러리'}
              </span>
              <h2 className="text-lg font-bold leading-tight">게시글 등록</h2>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[#21262d]"
            style={{ color: '#7d8590' }}>
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* ── 바디 ── */}
        <form onSubmit={handleSubmit} className="flex flex-1 overflow-hidden">

          {/* 왼쪽: 폼 (스크롤) */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-7"
            style={{ borderRight: '1px solid #30363d' }}>

            {/* 제목 */}
            <div>
              <label className="block text-sm font-bold mb-2">
                제목 <span style={{ color: '#f85149' }}>*</span>
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={100}
                placeholder="작품 제목을 입력하세요"
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-base outline-none transition-colors"
                style={{
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  color: '#e6edf3',
                }}
                onFocus={e => e.currentTarget.style.borderColor = accentColor}
                onBlur={e => e.currentTarget.style.borderColor = '#30363d'}
              />
              <p className="text-xs mt-1.5 text-right" style={{ color: '#484f58' }}>{title.length}/100</p>
            </div>

            {/* 태그 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold">태그</label>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: accentBg, color: accentColor }}>
                  {selectedTags.length}/{MAX_TAGS}
                </span>
              </div>

              {/* 선택된 태그 + 인풋 */}
              <div
                className="flex flex-wrap gap-1.5 px-3 py-2.5 rounded-xl min-h-[46px] cursor-text transition-colors"
                style={{ background: '#0d1117', border: '1px solid #30363d' }}
                onClick={() => tagInputRef.current?.focus()}>
                {selectedTags.map(tag => (
                  <span key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ background: accentBg, color: accentColor, border: `1px solid ${accentBorder}` }}>
                    #{tag}
                    <button type="button" onClick={e => { e.stopPropagation(); removeTag(tag) }}
                      className="hover:text-white transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                    </button>
                  </span>
                ))}
                {selectedTags.length < MAX_TAGS && (
                  <input
                    ref={tagInputRef}
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleTagKey}
                    onBlur={() => tagInput.trim() && addTag(tagInput)}
                    placeholder={selectedTags.length === 0 ? '예: 픽셀아트, 판타지, 풍경 (Enter로 추가)' : ''}
                    className="flex-1 min-w-[180px] bg-transparent outline-none text-sm"
                    style={{ color: '#e6edf3' }}
                  />
                )}
              </div>

              {/* 인기 태그 — Suggested tags */}
              {topTags.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs mb-2" style={{ color: '#484f58' }}>인기 태그</p>
                  <div className="flex flex-wrap gap-1.5">
                    {topTags.slice(0, 15).map(tag => {
                      const selected = selectedTags.includes(tag.tagName)
                      return (
                        <button
                          key={tag.tagId}
                          type="button"
                          disabled={!selected && selectedTags.length >= MAX_TAGS}
                          onClick={() => selected ? removeTag(tag.tagName) : addTag(tag.tagName)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all disabled:opacity-30"
                          style={selected
                            ? { background: accentColor, color: '#fff' }
                            : { background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
                          {!selected && (
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>add</span>
                          )}
                          {tag.tagName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-bold mb-2">설명</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="작품에 대한 이야기를 들려주세요 (선택)"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-colors"
                style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                onFocus={e => e.currentTarget.style.borderColor = accentColor}
                onBlur={e => e.currentTarget.style.borderColor = '#30363d'}
              />
              <p className="text-xs mt-1.5 text-right" style={{ color: '#484f58' }}>{description.length}/2000</p>
            </div>

            {/* 공개 범위 */}
            <div>
              <label className="block text-sm font-bold mb-3">공개 범위</label>
              <div className="space-y-2">
                {([
                  { value: 'PUBLIC', label: '전체 공개', desc: '누구든지 이 작품을 볼 수 있습니다', icon: 'public' },
                  { value: 'UNLISTED', label: '링크 공유', desc: '링크를 가진 사람만 볼 수 있습니다', icon: 'link' },
                  { value: 'PRIVATE', label: '비공개', desc: '나만 볼 수 있습니다', icon: 'lock' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                    style={visibility === opt.value
                      ? { background: accentBg, border: `1px solid ${accentColor}` }
                      : { background: '#0d1117', border: '1px solid #30363d' }}>
                    <span className="material-symbols-outlined text-xl flex-shrink-0"
                      style={{ color: visibility === opt.value ? accentColor : '#484f58' }}>
                      {opt.icon}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{opt.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#7d8590' }}>{opt.desc}</p>
                    </div>
                    <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{
                        border: visibility === opt.value ? `2px solid ${accentColor}` : '2px solid #484f58',
                        background: visibility === opt.value ? accentColor : 'transparent',
                      }}>
                      {visibility === opt.value && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#fff' }} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* 오른쪽: 미리보기 패널 */}
          <div className="flex flex-col flex-shrink-0" style={{ width: 420 }}>

            {isFree ? (
              /* ── 자유 갤러리: 이미지 업로드 ── */
              <>
                {/* 상단 바 */}
                <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                  style={{ borderBottom: '1px solid #30363d' }}>
                  <span className="text-sm font-bold" style={{ color: '#7d8590' }}>
                    {images.length}/{MAX_IMAGES} 파일
                  </span>
                  {images.length > 0 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-sm font-bold transition-colors hover:text-white"
                      style={{ color: accentColor }}>
                      <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                      이미지 추가
                    </button>
                  )}
                </div>

                {/* 메인 미리보기 */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden"
                  style={{ background: '#0d1117' }}
                  onDrop={e => { e.preventDefault(); setDraggingImg(false); addImages(e.dataTransfer.files) }}
                  onDragOver={e => { e.preventDefault(); setDraggingImg(true) }}
                  onDragLeave={() => setDraggingImg(false)}>

                  {images.length === 0 ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-4 cursor-pointer select-none p-8 text-center rounded-2xl transition-all"
                      style={{
                        border: `2px dashed ${draggingImg ? accentColor : '#30363d'}`,
                        background: draggingImg ? accentBg : 'transparent',
                      }}>
                      <span className="material-symbols-outlined text-5xl" style={{ color: draggingImg ? accentColor : '#30363d' }}>
                        add_photo_alternate
                      </span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: draggingImg ? accentColor : '#7d8590' }}>
                          {draggingImg ? '여기에 놓으세요' : '이미지를 드래그하거나 클릭하세요'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: '#484f58' }}>PNG, JPG, GIF, WEBP · 최대 {MAX_IMAGES}장</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <img
                        src={images[activeIdx]?.previewUrl}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      {/* 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={() => removeImage(images[activeIdx].id)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(248,81,73,0.85)' }}>
                        <span className="material-symbols-outlined text-base text-white">delete</span>
                      </button>
                      {images[activeIdx] && activeIdx === 0 && (
                        <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-lg"
                          style={{ background: accentColor, color: '#fff' }}>대표</span>
                      )}
                    </>
                  )}
                </div>

                {/* 하단 썸네일 스트립 */}
                {images.length > 0 && (
                  <div className="flex gap-2 px-4 py-3 overflow-x-auto flex-shrink-0"
                    style={{ borderTop: '1px solid #30363d' }}>
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setActiveIdx(idx)}
                        className="flex-shrink-0 relative rounded-lg overflow-hidden transition-all"
                        style={{
                          width: 56, height: 56,
                          outline: activeIdx === idx ? `2px solid ${accentColor}` : '2px solid transparent',
                          outlineOffset: 2,
                        }}>
                        <img src={img.previewUrl} alt="" className="w-full h-full object-cover"
                          style={{ imageRendering: 'pixelated' }} />
                      </button>
                    ))}
                    {images.length < MAX_IMAGES && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-shrink-0 rounded-lg flex items-center justify-center transition-colors hover:border-[#2f81f7]"
                        style={{ width: 56, height: 56, border: '2px dashed #30363d' }}>
                        <span className="material-symbols-outlined text-lg" style={{ color: '#484f58' }}>add</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* ── 전용 갤러리: JSON 파일 + 캔버스 ── */
              <>
                {/* 상단 바 */}
                <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                  style={{ borderBottom: '1px solid #30363d' }}>
                  <span className="text-sm font-bold" style={{ color: '#7d8590' }}>
                    {fileInfo ? '파일 로드됨' : '파일 없음'}
                  </span>
                  {fileInfo && (
                    <button
                      type="button"
                      onClick={() => jsonInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-sm font-bold transition-colors hover:text-white"
                      style={{ color: accentColor }}>
                      <span className="material-symbols-outlined text-base">upload_file</span>
                      파일 교체
                    </button>
                  )}
                </div>

                {/* 메인 영역 */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden p-6"
                  style={{ background: '#0d1117' }}
                  onDrop={e => { e.preventDefault(); setDraggingFile(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
                  onDragOver={e => { e.preventDefault(); setDraggingFile(true) }}
                  onDragLeave={() => setDraggingFile(false)}>

                  {!fileInfo ? (
                    <div
                      onClick={() => jsonInputRef.current?.click()}
                      className="flex flex-col items-center gap-4 cursor-pointer select-none p-8 text-center rounded-2xl transition-all w-full"
                      style={{
                        border: `2px dashed ${draggingFile ? accentColor : '#30363d'}`,
                        background: draggingFile ? accentBg : 'transparent',
                      }}>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
                        <span className="material-symbols-outlined text-3xl"
                          style={{ color: draggingFile ? accentColor : '#7d8590' }}>upload_file</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: draggingFile ? accentColor : '#7d8590' }}>
                          {draggingFile ? '여기에 놓으세요' : '픽셀 파일을 드래그하거나 클릭하세요'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: '#484f58' }}>PixelHub 전용 포맷 (.json)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center gap-4">
                      {/* 파일 정보 */}
                      <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: '#161b22', border: '1px solid #30363d' }}>
                        <span className="material-symbols-outlined text-xl" style={{ color: accentColor }}>description</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{fileInfo.name}</p>
                          <p className="text-xs" style={{ color: '#7d8590' }}>
                            {fileInfo.width}×{fileInfo.height}px · 레이어 {fileInfo.layerCount}개
                          </p>
                        </div>
                      </div>
                      {/* 캔버스 */}
                      <div className="rounded-xl overflow-hidden flex items-center justify-center"
                        style={{ background: '#161b22', border: '1px solid #30363d', padding: 12 }}>
                        <canvas ref={canvasRef}
                          style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: 280 }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 에러 */}
                {parseError && (
                  <div className="mx-4 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl flex-shrink-0"
                    style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)' }}>
                    <span className="material-symbols-outlined text-base mt-0.5" style={{ color: '#f85149' }}>error</span>
                    <p className="text-xs" style={{ color: '#f85149' }}>{parseError}</p>
                  </div>
                )}

                {/* 안내 */}
                <div className="mx-4 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl flex-shrink-0"
                  style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
                  <span className="material-symbols-outlined text-base mt-0.5" style={{ color: accentColor }}>info</span>
                  <p className="text-xs leading-relaxed" style={{ color: '#7d8590' }}>
                    에디터에서 작업 후 <strong style={{ color: '#e6edf3' }}>내보내기 → .json</strong>으로 저장하여 업로드하세요.
                  </p>
                </div>
              </>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => e.target.files && addImages(e.target.files)} />
            <input ref={jsonInputRef} type="file" accept=".json,application/json" className="hidden"
              onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
          </div>
        </form>

        {/* ── 하단 고정 액션바 ── */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid #30363d', background: '#161b22' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm transition-colors hover:bg-[#21262d]"
            style={{ border: '1px solid #30363d', color: '#7d8590' }}>
            취소
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || (!isFree ? !fileInfo : false)}
            className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: accentColor, color: '#fff' }}>
            {submitting
              ? <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  등록 중...
                </span>
              : '게시글 등록'}
          </button>
        </div>

      </div>
    </div>
  )
}
