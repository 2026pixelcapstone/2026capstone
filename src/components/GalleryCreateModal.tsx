import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  galleryApi, type GalleryType, type Visibility, type TagResponse, type DedicatedVisibility,
} from '../api/galleryApi'
import { tagApi } from '../api/tagApi'
import { fileApi } from '../api/fileApi'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '../lib/fileValidation'
import {
  parsePpit, compositeAllFrames, renderThumbnailBlob, renderGifBlob, ppitTextToFile,
  type PpitFile,
} from '../lib/ppit'

const MAX_TAGS = 10
const MAX_IMAGES = 10
const MAX_CANVAS_SIZE = 1024 // 브라우저 프리징 방지 상한

interface LocalImage {
  id: string
  file: File
  previewUrl: string
}

// 전용(.ppit) 로드 결과
interface PpitInfo {
  name: string
  text: string                    // 원본 .ppit 텍스트 (R2 업로드용)
  ppit: PpitFile
  frameCanvases: HTMLCanvasElement[]  // 프레임별 합성 결과(미리보기·썸네일·GIF 재사용)
}

const DEFAULT_VISIBILITY: Required<DedicatedVisibility> = {
  canvas: true, palette: true, layers: true, download: false, // download 기본 비공개(스펙 §6)
}

const VIS_OPTIONS = [
  { key: 'canvas', label: '캔버스 크기/배경', icon: 'crop_free' },
  { key: 'palette', label: '팔레트', icon: 'palette' },
  { key: 'layers', label: '레이어 구조', icon: 'layers' },
  { key: 'download', label: '.ppit 원본 다운로드 제공', icon: 'download' },
] as const

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
  const [uploadProgress, setUploadProgress] = useState(0)   // 자유 갤러리 이미지 업로드 진행률(%)
  const [topTags, setTopTags] = useState<TagResponse[]>([])

  // ── 태그 자동완성 ──
  const [tagSuggestions, setTagSuggestions] = useState<TagResponse[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [activeSuggestIdx, setActiveSuggestIdx] = useState(-1)
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 드롭다운 열림 상태를 ref로 추적 (window ESC 리스너에서 최신값 참조용)
  const showSuggestRef = useRef(false)
  useEffect(() => { showSuggestRef.current = showSuggest }, [showSuggest])

  // ── 자유 갤러리: 이미지 ──
  const [images, setImages] = useState<LocalImage[]>([])
  const [draggingImg, setDraggingImg] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 전용 갤러리: .ppit 파일 ──
  const [ppitInfo, setPpitInfo] = useState<PpitInfo | null>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [dedVis, setDedVis] = useState<Required<DedicatedVisibility>>(DEFAULT_VISIBILITY)
  const ppitInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)

  const tagInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 모달 열릴 때 상태 초기화
  useEffect(() => {
    if (!isOpen) return
    setTitle(''); setDescription(''); setVisibility('PUBLIC')
    setSelectedTags([]); setTagInput(''); setSubmitting(false)
    setTagSuggestions([]); setShowSuggest(false); setActiveSuggestIdx(-1)
    // 이미지 ObjectURL revoke 후 초기화 (메모리 누수 방지)
    setImages(prev => { prev.forEach(img => URL.revokeObjectURL(img.previewUrl)); return [] })
    setDraggingImg(false); setActiveIdx(0)
    setPpitInfo(null); setDraggingFile(false); setParseError(null)
    setDedVis(DEFAULT_VISIBILITY)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [isOpen])

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 태그 자동완성 드롭다운이 열려 있으면 모달은 닫지 않고 드롭다운만 닫는다
      if (showSuggestRef.current) {
        setShowSuggest(false); setActiveSuggestIdx(-1)
        return
      }
      onClose()
    }
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

  // 태그 자동완성 — 디바운스 서버 검색
  useEffect(() => {
    const keyword = tagInput.trim()
    if (!keyword || selectedTags.length >= MAX_TAGS) {
      setTagSuggestions([]); setShowSuggest(false)
      return
    }
    let ignore = false
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current)
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const res = await tagApi.search(keyword)
        if (ignore) return  // 늦게 도착한 이전 요청 무시 (race condition 방지)
        const filtered = res.data.data.filter(t => !selectedTags.includes(t.tagName))
        setTagSuggestions(filtered)
        setShowSuggest(filtered.length > 0)
        setActiveSuggestIdx(-1)
      } catch {
        if (!ignore) { setTagSuggestions([]); setShowSuggest(false) }
      }
    }, 200)
    return () => {
      ignore = true
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current)
    }
  }, [tagInput, selectedTags])

  // 캔버스 미리보기 — 합성 프레임 렌더 + (frames>1) fps 애니메이션
  useEffect(() => {
    const target = canvasRef.current
    if (!ppitInfo || !target) return
    const { ppit, frameCanvases } = ppitInfo
    const ctx = target.getContext('2d')
    if (!ctx) return
    const { width, height, fps } = ppit.canvas
    const scale = Math.max(1, Math.min(Math.floor(256 / Math.max(width, height)) || 1, 16))
    target.width = width * scale
    target.height = height * scale
    ctx.imageSmoothingEnabled = false

    const draw = (i: number) => {
      ctx.clearRect(0, 0, target.width, target.height)
      ctx.drawImage(frameCanvases[i], 0, 0, target.width, target.height)
    }
    draw(0)
    if (frameCanvases.length <= 1) return

    let idx = 0
    let last = performance.now()
    const interval = 1000 / (fps || 12)
    const loop = (t: number) => {
      if (t - last >= interval) { idx = (idx + 1) % frameCanvases.length; draw(idx); last = t }
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [ppitInfo])

  // ── 이미지 추가 (FREE) ──
  const addImages = useCallback((files: FileList | File[]) => {
    let arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    const oversized = arr.filter(f => f.size > MAX_UPLOAD_BYTES)
    if (oversized.length > 0) {
      toast.error(`${oversized.length}개 이미지가 ${MAX_UPLOAD_MB}MB를 초과해 제외했습니다.`)
      arr = arr.filter(f => f.size <= MAX_UPLOAD_BYTES)
    }
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

  // ── .ppit 파일 처리 (DEDICATED) ──
  const processFile = useCallback((file: File) => {
    setParseError(null); setPpitInfo(null)
    if (file.size > MAX_UPLOAD_BYTES) {
      setParseError(`${MAX_UPLOAD_MB}MB를 초과하는 파일은 업로드할 수 없습니다.`)
      return
    }
    if (!/\.(ppit|json)$/i.test(file.name)) {
      setParseError('.ppit 파일만 업로드할 수 있습니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      try {
        const ppit = parsePpit(text)
        if (ppit.canvas.width > MAX_CANVAS_SIZE || ppit.canvas.height > MAX_CANVAS_SIZE) {
          setParseError(`캔버스가 너무 큽니다. (최대 ${MAX_CANVAS_SIZE}px)`)
          return
        }
        const frameCanvases = await compositeAllFrames(ppit)
        setPpitInfo({ name: file.name, text, ppit, frameCanvases })
        setTitle(prev => prev || file.name.replace(/\.(ppit|json)$/i, ''))
      } catch (err) {
        setParseError(err instanceof Error ? err.message : '.ppit 파싱에 실패했습니다.')
      }
    }
    reader.onerror = () => setParseError('파일을 읽지 못했습니다. 다시 시도해 주세요.')
    reader.readAsText(file)
  }, [])

  // ── 태그 ──
  const addTag = (name: string) => {
    const t = name.trim().replace(/^#/, '')
    if (!t || selectedTags.includes(t) || selectedTags.length >= MAX_TAGS) return
    setSelectedTags(prev => [...prev, t]); setTagInput('')
    setTagSuggestions([]); setShowSuggest(false); setActiveSuggestIdx(-1)
  }
  const removeTag = (name: string) => setSelectedTags(prev => prev.filter(t => t !== name))
  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && showSuggest) {
      e.preventDefault(); setActiveSuggestIdx(i => Math.min(i + 1, tagSuggestions.length - 1))
    } else if (e.key === 'ArrowUp' && showSuggest) {
      e.preventDefault(); setActiveSuggestIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (showSuggest && activeSuggestIdx >= 0 && tagSuggestions[activeSuggestIdx]) {
        addTag(tagSuggestions[activeSuggestIdx].tagName)
      } else {
        addTag(tagInput)
      }
    } else if (e.key === 'Escape' && showSuggest) {
      setShowSuggest(false); setActiveSuggestIdx(-1)
    } else if (e.key === 'Backspace' && tagInput === '' && selectedTags.length > 0) {
      removeTag(selectedTags.at(-1)!)
    }
  }

  // ── 제출 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (isFree && images.length === 0) { toast.error('이미지를 1장 이상 업로드해주세요.'); return }
    if (!isFree && !ppitInfo) { toast.error('.ppit 파일을 업로드해주세요.'); return }
    setSubmitting(true)
    setUploadProgress(0)
    // 전용 업로드 실패 시 보상 삭제용
    const uploaded: string[] = []
    try {
      if (isFree) {
        // ── 자유 갤러리: 이미지 업로드 → 게시글 ──
        toast.info(`이미지 ${images.length}장 업로드 중...`)
        const imageUrls = await fileApi.uploadImages(
          images.map(img => img.file), 'gallery/images', setUploadProgress,
        )
        const res = await galleryApi.createPost({
          title: title.trim(),
          description: description.trim() || undefined,
          galleryType: type,
          visibility,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          imageUrls,
          thumbnailUrl: imageUrls[0],
        })
        toast.success('게시글이 등록되었습니다.')
        onClose()
        navigate(`/gallery/${res.data.data.postId}`)
        return
      }

      // ── 전용 갤러리(.ppit): 썸네일/GIF 렌더 → .ppit·썸네일 업로드 → 게시글 ──
      const { ppit, text, name, frameCanvases } = ppitInfo!
      const animated = frameCanvases.length > 1

      toast.info('미리보기 생성 중...')
      // 썸네일: 애니메이션이면 GIF, 단일 프레임이면 정적 PNG
      let thumbBlob: Blob
      let thumbExt: string
      if (animated) {
        const gif = await renderGifBlob(ppit, frameCanvases)
        thumbBlob = gif ?? await renderThumbnailBlob(ppit)
        thumbExt = gif ? 'gif' : 'png'
      } else {
        thumbBlob = await renderThumbnailBlob(ppit)
        thumbExt = 'png'
      }
      const baseName = name.replace(/\.(ppit|json)$/i, '') || 'artwork'

      toast.info('파일 업로드 중...')
      const thumbFile = new File([thumbBlob], `${baseName}.${thumbExt}`, { type: thumbBlob.type })
      const thumbnailUrl = await fileApi.uploadImage(thumbFile, 'gallery/dedicated')
      uploaded.push(thumbnailUrl)
      const fileUrl = await fileApi.uploadImage(ppitTextToFile(text, baseName), 'gallery/dedicated')
      uploaded.push(fileUrl)

      const res = await galleryApi.createPost({
        title: title.trim(),
        description: description.trim() || undefined,
        galleryType: type,
        visibility,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        thumbnailUrl,
        fileUrl,
        canvasWidth: ppit.canvas.width,
        canvasHeight: ppit.canvas.height,
        palette: ppit.palette,
        dedicatedVisibility: dedVis,
      })
      toast.success('게시글이 등록되었습니다.')
      onClose()
      navigate(`/gallery/${res.data.data.postId}`)
    } catch (err) {
      // 게시글 생성 전 업로드된 R2 파일 보상 삭제 (베스트 에포트)
      if (uploaded.length > 0) fileApi.deleteFiles(uploaded).catch(() => {})
      toast.error(getErrorMessage(err, '게시글 등록에 실패했습니다.'))
    } finally {
      setSubmitting(false)
      setUploadProgress(0)
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
              <div className="relative">
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
                      onBlur={() => { tagInput.trim() && addTag(tagInput) }}
                      placeholder={selectedTags.length === 0 ? '예: 픽셀아트, 판타지, 풍경 (Enter로 추가)' : ''}
                      className="flex-1 min-w-[180px] bg-transparent outline-none text-sm"
                      style={{ color: '#e6edf3' }}
                      autoComplete="off"
                    />
                  )}
                </div>

                {/* 자동완성 드롭다운 */}
                {showSuggest && tagSuggestions.length > 0 && (
                  <ul role="listbox"
                    className="absolute z-30 mt-1 w-full max-h-52 overflow-auto rounded-xl shadow-xl"
                    style={{ background: '#161b22', border: '1px solid #30363d' }}>
                    {tagSuggestions.map((s, idx) => (
                      <li key={s.tagId} role="option" aria-selected={idx === activeSuggestIdx}
                        onMouseEnter={() => setActiveSuggestIdx(idx)}
                        onMouseDown={e => { e.preventDefault(); addTag(s.tagName) }}
                        className="px-4 py-2 text-sm cursor-pointer flex items-center gap-1"
                        style={idx === activeSuggestIdx
                          ? { background: accentBg, color: accentColor }
                          : { color: '#e6edf3' }}>
                        <span style={{ color: '#484f58' }}>#</span>{s.tagName}
                      </li>
                    ))}
                  </ul>
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

            {/* 공개 항목 토글 (전용 갤러리 전용) */}
            {!isFree && (
              <div>
                <label className="block text-sm font-bold mb-1">공개 항목</label>
                <p className="text-xs mb-3" style={{ color: '#7d8590' }}>
                  작품 뷰어는 항상 공개됩니다. 아래 항목만 공개 여부를 선택하세요.
                </p>
                <div className="space-y-2">
                  {VIS_OPTIONS.map(opt => {
                    const on = dedVis[opt.key]
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setDedVis(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all"
                        style={on
                          ? { background: accentBg, border: `1px solid ${accentColor}` }
                          : { background: '#0d1117', border: '1px solid #30363d' }}>
                        <span className="material-symbols-outlined text-lg flex-shrink-0"
                          style={{ color: on ? accentColor : '#484f58' }}>{opt.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold">{opt.label}</p>
                          {opt.key === 'download' && (
                            <p className="text-xs mt-0.5" style={{ color: '#7d8590' }}>
                              켜면 다른 사용자가 .ppit 원본을 내려받아 리믹스/편집할 수 있습니다
                            </p>
                          )}
                        </div>
                        {/* 토글 스위치 */}
                        <div className="w-9 h-5 rounded-full flex-shrink-0 flex items-center transition-all px-0.5"
                          style={{ background: on ? accentColor : '#30363d', justifyContent: on ? 'flex-end' : 'flex-start' }}>
                          <div className="w-4 h-4 rounded-full" style={{ background: '#fff' }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

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
              /* ── 전용 갤러리: .ppit 파일 + 합성 미리보기 ── */
              <>
                {/* 상단 바 */}
                <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                  style={{ borderBottom: '1px solid #30363d' }}>
                  <span className="text-sm font-bold" style={{ color: '#7d8590' }}>
                    {ppitInfo
                      ? (ppitInfo.frameCanvases.length > 1 ? `애니메이션 · ${ppitInfo.frameCanvases.length}프레임` : '파일 로드됨')
                      : '파일 없음'}
                  </span>
                  {ppitInfo && (
                    <button
                      type="button"
                      onClick={() => ppitInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-sm font-bold transition-colors hover:text-white"
                      style={{ color: accentColor }}>
                      <span className="material-symbols-outlined text-base">upload_file</span>
                      파일 교체
                    </button>
                  )}
                </div>

                {/* 메인 영역 */}
                <div className="flex-1 flex items-center justify-center relative overflow-y-auto p-6"
                  style={{ background: '#0d1117' }}
                  onDrop={e => { e.preventDefault(); setDraggingFile(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
                  onDragOver={e => { e.preventDefault(); setDraggingFile(true) }}
                  onDragLeave={() => setDraggingFile(false)}>

                  {!ppitInfo ? (
                    <div
                      onClick={() => ppitInputRef.current?.click()}
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
                          {draggingFile ? '여기에 놓으세요' : '.ppit 파일을 드래그하거나 클릭하세요'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: '#484f58' }}>PixelPilot 전용 포맷 (.ppit)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center gap-4">
                      {/* 파일 정보 */}
                      <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: '#161b22', border: '1px solid #30363d' }}>
                        <span className="material-symbols-outlined text-xl" style={{ color: accentColor }}>description</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{ppitInfo.name}</p>
                          <p className="text-xs" style={{ color: '#7d8590' }}>
                            {ppitInfo.ppit.canvas.width}×{ppitInfo.ppit.canvas.height}px
                            {' · '}레이어 {ppitInfo.ppit.frames[0]?.layers.length ?? 0}개
                            {ppitInfo.frameCanvases.length > 1 && ` · ${ppitInfo.frameCanvases.length}프레임 @ ${ppitInfo.ppit.canvas.fps}fps`}
                          </p>
                        </div>
                      </div>
                      {/* 합성 미리보기 캔버스 (체커보드 배경) */}
                      <div className="rounded-xl overflow-hidden flex items-center justify-center"
                        style={{
                          background: '#161b22', border: '1px solid #30363d', padding: 12,
                          backgroundImage: 'linear-gradient(45deg,#1a1a1a 25%,transparent 25%,transparent 75%,#1a1a1a 75%),linear-gradient(45deg,#1a1a1a 25%,#222 25%,#222 75%,#1a1a1a 75%)',
                          backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px',
                        }}>
                        <canvas ref={canvasRef}
                          style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: 240 }} />
                      </div>
                      {/* 팔레트 스와치 */}
                      {ppitInfo.ppit.palette && ppitInfo.ppit.palette.colors.length > 0 && (
                        <div className="w-full">
                          <p className="text-xs font-bold mb-2" style={{ color: '#7d8590' }}>
                            팔레트{ppitInfo.ppit.palette.name ? ` · ${ppitInfo.ppit.palette.name}` : ''}
                            {' '}({ppitInfo.ppit.palette.colors.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ppitInfo.ppit.palette.colors.map((c, i) => (
                              <div key={`${c}-${i}`} title={c}
                                className="w-6 h-6 rounded-md flex-shrink-0"
                                style={{ background: c, border: '1px solid #30363d' }} />
                            ))}
                          </div>
                        </div>
                      )}
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
                    에디터에서 작업 후 <strong style={{ color: '#e6edf3' }}>내보내기 → .ppit</strong>으로 저장하여 업로드하세요.
                    썸네일·애니메이션·팔레트는 업로드 시 자동 생성됩니다.
                  </p>
                </div>
              </>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = '' }} />
            <input ref={ppitInputRef} type="file" accept=".ppit,.json,application/json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) processFile(f) }} />
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
            disabled={submitting || !title.trim() || (!isFree && !ppitInfo)}
            className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: accentColor, color: '#fff' }}>
            {submitting
              ? <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  {isFree && uploadProgress > 0 && uploadProgress < 100
                    ? `업로드 중 ${uploadProgress}%`
                    : '등록 중...'}
                </span>
              : '게시글 등록'}
          </button>
        </div>

      </div>
    </div>
  )
}
