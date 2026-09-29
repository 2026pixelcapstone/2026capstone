import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { assetApi, type AssetCategory, type AssetLicenseType, type AssetVersion } from '../api/assetApi'
import { fileApi } from '../api/fileApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'
import TagInput from '../components/TagInput'

const MAX_IMAGES = 5

// 기존 이미지(URL) 또는 새로 추가한 이미지(File)
type ImageItem =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File; previewUrl: string }

/** bytes 를 읽기 쉬운 크기 문자열(B/KB/MB)로 변환. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AssetUpdatePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const assetId = Number(id)
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isFree, setIsFree] = useState(true)
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [licenseTypeId, setLicenseTypeId] = useState('')
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [licenseTypes, setLicenseTypes] = useState<AssetLicenseType[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [images, setImages] = useState<ImageItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── 다운로드 파일 버전 교체 ──
  const [versions, setVersions] = useState<AssetVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsError, setVersionsError] = useState(false)
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null)
  const [versionNote, setVersionNote] = useState('')
  const [replacing, setReplacing] = useState(false)
  const versionInputRef = useRef<HTMLInputElement>(null)

  /** 버전 히스토리 로드 — 실패 시 versionsError로 구분(빈 목록과 혼동 방지). */
  const loadVersions = useCallback(async () => {
    setVersionsLoading(true)
    setVersionsError(false)
    try {
      const vres = await assetApi.getVersions(assetId)
      setVersions(vres.data.data)
    } catch {
      setVersionsError(true)
    } finally {
      setVersionsLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    let cancelled = false
    Promise.all([assetApi.getCategories(), assetApi.getLicenseTypes()])
      .then(([catRes, licRes]) => {
        if (cancelled) return
        setCategories(catRes.data.data)
        setLicenseTypes(licRes.data.data)
      })
      .catch(() => { if (!cancelled) toast.error('카테고리/라이선스 목록을 불러오지 못했습니다.') })
    return () => { cancelled = true }
  }, [])

  const imageInputRef = useRef<HTMLInputElement>(null)

  // ── 기존 데이터 로드 ─────────────────────────────────────
  useEffect(() => {
    // 잘못된 assetId(NaN, 0 이하)면 즉시 리다이렉트 (무한 로딩 방지)
    if (!Number.isInteger(assetId) || assetId <= 0) {
      toast.error('잘못된 에셋 주소입니다.')
      navigate('/assets', { replace: true })
      return
    }

    const fetchAsset = async () => {
      setLoading(true)
      try {
        const res = await assetApi.getAsset(assetId)
        const asset = res.data.data

        // 작성자 검증
        if (user?.userId !== asset.authorId) {
          toast.error('수정 권한이 없습니다.')
          navigate(`/assets/${assetId}`, { replace: true })
          return
        }

        setTitle(asset.title)
        setDescription(asset.description ?? '')
        setIsFree(asset.isFree || asset.price === 0)
        setPrice(asset.price > 0 ? String(asset.price) : '')
        setCategoryId(asset.categoryId ? String(asset.categoryId) : '')
        setLicenseTypeId(asset.licenseTypeId ? String(asset.licenseTypeId) : '')
        setSelectedTags(asset.tags ?? [])
        // 상세 페이지와 동일 계약: imageUrls가 비면 thumbnailUrl로 fallback
        const existingUrls = asset.imageUrls?.length
          ? asset.imageUrls
          : ([asset.thumbnailUrl].filter(Boolean) as string[])
        setImages(existingUrls.map(url => ({ kind: 'existing' as const, url })))

        // 버전 히스토리는 별도로 로드(에셋 정보 표시를 막지 않도록 await하지 않음)
        void loadVersions()
      } catch (err) {
        toast.error(getErrorMessage(err, '에셋을 불러오지 못했습니다.'))
        navigate('/assets', { replace: true })
      } finally {
        setLoading(false)
      }
    }
    fetchAsset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId])

  // ── 이미지 추가 ──────────────────────────────────────────
  const addImages = useCallback((files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    setImages(prev => {
      const remaining = MAX_IMAGES - prev.length
      const toAdd = imageFiles.slice(0, remaining).map(file => ({
        kind: 'new' as const,
        file,
        previewUrl: URL.createObjectURL(file),
      }))
      return [...prev, ...toAdd]
    })
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addImages(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addImages(Array.from(e.dataTransfer.files))
  }

  const removeImage = (idx: number) => {
    setImages(prev => {
      const item = prev[idx]
      if (item.kind === 'new') URL.revokeObjectURL(item.previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }


  const previewOf = (item: ImageItem) => item.kind === 'existing' ? item.url : item.previewUrl

  // ── 제출 ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (images.length === 0) { toast.error('미리보기 이미지를 1장 이상 유지해주세요.'); return }
    if (!isFree && (!price || Number(price) <= 0)) { toast.error('유료 에셋의 가격을 입력해주세요.'); return }

    setSubmitting(true)
    let uploadedUrls: string[] = []
    try {
      // 새로 추가한 이미지만 업로드
      const newFiles = images.filter((i): i is Extract<ImageItem, { kind: 'new' }> => i.kind === 'new')
      if (newFiles.length > 0) {
        uploadedUrls = await fileApi.uploadImages(newFiles.map(i => i.file), 'assets/images')
      }

      // 기존 + 신규 URL을 순서대로 병합
      let uploadIdx = 0
      const finalUrls = images.map(item =>
        item.kind === 'existing' ? item.url : uploadedUrls[uploadIdx++]
      )

      const res = await assetApi.updateAsset(assetId, {
        title: title.trim(),
        description: description.trim() || undefined,
        isFree,
        price: isFree ? 0 : Number(price),
        // 수정 폼은 항상 현재값을 보냄 — '선택 안 함'이면 null로 명시 전송해 해제 반영
        categoryId: categoryId ? Number(categoryId) : null,
        licenseTypeId: licenseTypeId ? Number(licenseTypeId) : null,
        imageUrls: finalUrls,
        thumbnailUrl: finalUrls[0],
        tags: selectedTags,
      })

      toast.success('에셋이 수정되었습니다.')
      navigate(`/assets/${res.data.data.assetId}`)
    } catch (err) {
      // 신규 이미지는 업로드됐으나 수정 실패 시 R2 고아 파일 정리
      await fileApi.deleteFiles(uploadedUrls).catch(() => {})
      toast.error(getErrorMessage(err, '에셋 수정에 실패했습니다.'))
    } finally {
      images.forEach(i => { if (i.kind === 'new') URL.revokeObjectURL(i.previewUrl) })
      setSubmitting(false)
    }
  }

  /** 다운로드 파일을 새 버전으로 교체 — R2 업로드 → addVersion. 등록 실패 시에만 업로드 파일 정리. */
  const handleReplaceVersion = async () => {
    if (replacing || !newVersionFile) return
    setReplacing(true)
    let uploadedUrl = ''
    let registered = false
    try {
      uploadedUrl = await fileApi.uploadImage(newVersionFile, 'assets/files')
      await assetApi.addVersion(assetId, {
        fileUrl: uploadedUrl,
        fileSize: newVersionFile.size,
        changeNote: versionNote.trim() || undefined,
      })
      registered = true   // 이 시점부터 파일은 서버에 등록됨 → 이후 실패해도 삭제 금지
      setNewVersionFile(null)
      setVersionNote('')
      if (versionInputRef.current) versionInputRef.current.value = ''
      toast.success('새 버전으로 교체했습니다.')
    } catch (err) {
      // 업로드됐으나 "등록 전" 실패일 때만 R2 고아 파일 정리
      if (uploadedUrl && !registered) await fileApi.deleteFiles([uploadedUrl]).catch(() => {})
      toast.error(getErrorMessage(err, '버전 교체에 실패했습니다.'))
    } finally {
      setReplacing(false)
    }
    // 히스토리 갱신은 등록 성공 후 별도로 — 갱신 실패가 파일 삭제로 이어지지 않게 try 밖에서
    if (registered) void loadVersions()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-background)' }}>
        <div className="animate-spin rounded-full w-10 h-10 border-2" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-8">에셋 수정</h1>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8">

        {/* ── 왼쪽: 폼 ── */}
        <div className="flex-1 flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              className="w-full bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* 다운로드 파일 버전 교체 */}
          <div className="rounded-lg border p-4"
            style={{ borderColor: 'var(--color-outline)', background: 'var(--color-surface-container)' }}>
            <div className="text-sm font-bold mb-1" style={{ color: 'var(--color-on-surface)' }}>다운로드 파일 버전</div>
            <p className="text-xs mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
              새 파일을 올리면 최신 버전으로 교체됩니다. 이전 버전은 히스토리에 남습니다.
            </p>

            {/* 버전 히스토리 */}
            {versionsLoading ? (
              <div role="status" aria-live="polite" className="text-xs py-2" style={{ color: 'var(--color-on-surface-variant)' }}>버전 불러오는 중…</div>
            ) : versionsError ? (
              <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span>버전 목록을 불러오지 못했습니다.</span>
                <button type="button" onClick={loadVersions}
                  className="underline font-bold" style={{ color: 'var(--color-primary)' }}>다시 시도</button>
              </div>
            ) : versions.length > 0 ? (
              <ul className="flex flex-col gap-1.5 mb-3">
                {versions.map(v => (
                  <li key={v.versionId}
                    className="flex items-center gap-2 text-xs rounded px-2 py-1.5"
                    style={{ background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' }}>
                    <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>{v.versionName}</span>
                    {v.isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>현재</span>
                    )}
                    <span>{formatFileSize(v.fileSize)}</span>
                    {v.changeNote && <span className="truncate">· {v.changeNote}</span>}
                    <span className="ml-auto shrink-0">{v.createdAt.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" aria-live="polite" className="text-xs mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>등록된 다운로드 파일이 없습니다.</p>
            )}

            {/* 새 버전 업로드 */}
            <label htmlFor="version-file" className="block text-xs font-medium mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>새 파일 선택</label>
            <input id="version-file" ref={versionInputRef} type="file"
              aria-label="다운로드 파일 선택"
              onChange={e => setNewVersionFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs mb-2"
              style={{ color: 'var(--color-on-surface-variant)' }} />
            {newVersionFile && (
              <p className="text-xs mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                선택: {newVersionFile.name} ({formatFileSize(newVersionFile.size)})
              </p>
            )}
            <input type="text" value={versionNote} onChange={e => setVersionNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
              aria-label="변경 메모"
              placeholder="변경 메모 (선택)" maxLength={200}
              className="w-full text-xs rounded border px-3 py-2 mb-2 bg-transparent"
              style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }} />
            <button type="button" onClick={handleReplaceVersion} disabled={!newVersionFile || replacing}
              className="w-full py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--color-primary)' }}>
              {replacing ? '교체 중…' : '새 버전으로 교체'}
            </button>
          </div>

          {/* 무료/유료 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">가격 설정</label>
            <div className="flex gap-3 mb-3">
              <button type="button" onClick={() => setIsFree(true)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  isFree ? 'bg-green-600 text-white' : 'bg-surface-container border border-gray-600 text-gray-400 hover:border-green-500'
                }`}>무료</button>
              <button type="button" onClick={() => setIsFree(false)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  !isFree ? 'bg-yellow-600 text-white' : 'bg-surface-container border border-gray-600 text-gray-400 hover:border-yellow-500'
                }`}>유료</button>
            </div>
            {!isFree && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">₩</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} min={0}
                  placeholder="가격 입력"
                  className="flex-1 bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500" />
              </div>
            )}
          </div>

          {/* 카테고리 / 라이선스 */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">카테고리</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="w-full bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500">
                <option value="">선택 안 함</option>
                {categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name}</option>))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">라이선스</label>
              <select value={licenseTypeId} onChange={e => setLicenseTypeId(e.target.value)}
                className="w-full bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500">
                <option value="">선택 안 함</option>
                {licenseTypes.map(l => (<option key={l.licenseTypeId} value={l.licenseTypeId}>{l.name}</option>))}
              </select>
            </div>
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              태그 <span className="text-gray-500 text-xs">(최대 10개, 입력 시 자동완성)</span>
            </label>
            <TagInput tags={selectedTags} onChange={setSelectedTags} max={10} />
          </div>
        </div>

        {/* ── 오른쪽: 미리보기 이미지 + 제출 ── */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <label className="block text-sm font-medium text-gray-300">
            미리보기 이미지 <span className="text-red-400">*</span>
            <span className="text-gray-500 text-xs ml-1">({images.length}/{MAX_IMAGES})</span>
          </label>

          <div
            role="button"
            tabIndex={0}
            aria-label="미리보기 이미지 추가"
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imageInputRef.current?.click() } }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleImageDrop}
            onClick={() => imageInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors h-48 ${
              dragging ? 'border-blue-400 bg-blue-900/20' : 'border-gray-600 hover:border-gray-400 bg-surface-container'
            } ${images.length >= MAX_IMAGES ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-gray-400 text-sm text-center">
              이미지를 드래그하거나 클릭하여 추가<br />
              <span className="text-gray-500 text-xs">PNG, JPG, GIF (최대 {MAX_IMAGES}장)</span>
            </p>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative group aspect-square">
                  <img src={previewOf(img)} alt={`preview-${idx}`} className="w-full h-full object-cover rounded-lg" />
                  {idx === 0 && <span className="absolute top-1 left-1 text-xs bg-blue-600 text-white px-1 rounded">대표</span>}
                  <button type="button" onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 mt-auto">
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {submitting ? '수정 중...' : '수정 완료'}
            </button>
            <button type="button" onClick={() => navigate(`/assets/${assetId}`)}
              className="w-full py-2.5 rounded-xl text-sm text-gray-400 border border-gray-600 hover:bg-surface-container transition-colors">
              취소
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
