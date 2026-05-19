import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { galleryApi, type GalleryType, type Visibility, type TagResponse } from '../api/galleryApi'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'

const MAX_TAGS = 10

export default function GalleryCreatePage() {
  const navigate = useNavigate()

  // ── 폼 상태 ──
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [galleryType, setGalleryType] = useState<GalleryType>('FREE')
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── 인기 태그 ──
  const [topTags, setTopTags] = useState<TagResponse[]>([])
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    galleryApi.getTags()
      .then(res => setTopTags(res.data.data))
      .catch(() => {/* 실패해도 UI는 동작 */})
  }, [])

  // ── 태그 추가 ──
  const addTag = (name: string) => {
    const trimmed = name.trim().replace(/^#/, '')
    if (!trimmed || selectedTags.includes(trimmed) || selectedTags.length >= MAX_TAGS) return
    setSelectedTags(prev => [...prev, trimmed])
    setTagInput('')
  }

  const removeTag = (name: string) => {
    setSelectedTags(prev => prev.filter(t => t !== name))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && tagInput === '' && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1])
    }
  }

  // ── 제출 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    setSubmitting(true)
    try {
      const res = await galleryApi.createPost({
        title: title.trim(),
        description: description.trim() || undefined,
        galleryType,
        visibility,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      })
      toast.success('게시글이 등록되었습니다.')
      navigate(`/gallery/${res.data.data.postId}`)
    } catch (err) {
      toast.error(getErrorMessage(err, '게시글 등록에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: '#0d1117', color: '#e6edf3', minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        <h1 className="text-2xl font-bold mb-8">갤러리 게시글 등록</h1>

        <form onSubmit={handleSubmit} className="space-y-6">

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
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: '#7d8590' }}>{title.length}/100</p>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-bold mb-2">설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="작품에 대한 설명을 입력하세요 (선택)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: '#7d8590' }}>{description.length}/2000</p>
          </div>

          {/* 갤러리 유형 */}
          <div>
            <label className="block text-sm font-bold mb-2">갤러리 유형</label>
            <div className="grid grid-cols-2 gap-3">
              {/* 자유 갤러리 */}
              <button
                type="button"
                onClick={() => setGalleryType('FREE')}
                className="p-4 rounded-xl text-left transition-colors"
                style={galleryType === 'FREE'
                  ? { background: 'rgba(47,129,247,0.1)', border: '2px solid #2f81f7' }
                  : { background: '#161b22', border: '2px solid #30363d' }}>
                <p className="font-bold text-sm">자유 갤러리</p>
                <p className="text-xs mt-0.5" style={{ color: '#7d8590' }}>일반 이미지 업로드</p>
              </button>
              {/* 전용 갤러리 — 에디터 전용이므로 비활성화 */}
              <div
                className="p-4 rounded-xl text-left opacity-40 cursor-not-allowed"
                style={{ background: '#161b22', border: '2px solid #30363d' }}>
                <p className="font-bold text-sm">전용 갤러리</p>
                <p className="text-xs mt-0.5" style={{ color: '#7d8590' }}>에디터 페이지에서만 공유 가능</p>
              </div>
            </div>
          </div>

          {/* 공개 범위 */}
          <div>
            <label className="block text-sm font-bold mb-2">공개 범위</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'PUBLIC', label: '전체 공개', icon: 'public' },
                { value: 'UNLISTED', label: '링크 공유', icon: 'link' },
                { value: 'PRIVATE', label: '비공개', icon: 'lock' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className="p-3 rounded-xl flex flex-col items-center gap-1 transition-colors"
                  style={visibility === opt.value
                    ? { background: 'rgba(47,129,247,0.1)', border: '2px solid #2f81f7' }
                    : { background: '#161b22', border: '2px solid #30363d' }}>
                  <span className="material-symbols-outlined text-lg"
                    style={{ color: visibility === opt.value ? '#2f81f7' : '#7d8590' }}>
                    {opt.icon}
                  </span>
                  <p className="text-xs font-bold">{opt.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-bold mb-2">
              태그
              <span className="ml-2 font-normal text-xs" style={{ color: '#7d8590' }}>
                최대 {MAX_TAGS}개
              </span>
            </label>

            {/* 인기 태그 */}
            {topTags.length > 0 && (
              <div className="mb-3">
                <p className="text-xs mb-2" style={{ color: '#7d8590' }}>인기 태그</p>
                <div className="flex flex-wrap gap-2">
                  {topTags.map(tag => {
                    const isSelected = selectedTags.includes(tag.tagName)
                    return (
                      <button
                        key={tag.tagId}
                        type="button"
                        disabled={!isSelected && selectedTags.length >= MAX_TAGS}
                        onClick={() => isSelected ? removeTag(tag.tagName) : addTag(tag.tagName)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-40"
                        style={isSelected
                          ? { background: '#2f81f7', color: '#fff' }
                          : { background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
                        #{tag.tagName}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 선택된 태그 + 직접 입력 */}
            <div
              className="flex flex-wrap gap-2 px-3 py-2 rounded-xl min-h-[46px] cursor-text"
              style={{ background: '#161b22', border: '1px solid #30363d' }}
              onClick={() => tagInputRef.current?.focus()}>
              {selectedTags.map(tag => (
                <span key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(47,129,247,0.15)', color: '#2f81f7', border: '1px solid rgba(47,129,247,0.3)' }}>
                  #{tag}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); removeTag(tag) }}
                    className="hover:text-white transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </span>
              ))}
              {selectedTags.length < MAX_TAGS && (
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => tagInput.trim() && addTag(tagInput)}
                  placeholder={selectedTags.length === 0 ? '태그 입력 후 Enter (예: 픽셀아트)' : ''}
                  className="flex-1 min-w-[120px] bg-transparent outline-none text-xs"
                  style={{ color: '#e6edf3' }}
                />
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: '#7d8590' }}>
              Enter 또는 쉼표(,)로 태그 추가 · Backspace로 마지막 태그 삭제
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-colors hover:bg-[#1c2128]"
              style={{ border: '1px solid #30363d', color: '#7d8590' }}>
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 hover:opacity-90"
              style={{ background: '#2f81f7', color: '#fff' }}>
              {submitting ? '등록 중...' : '게시글 등록'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
