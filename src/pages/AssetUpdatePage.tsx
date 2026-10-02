import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { assetApi, type AssetCategory, type AssetLicenseType } from '../api/assetApi'
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

// 기존 다운로드 파일(서버 등록됨) 또는 새로 추가한 파일(File)
type DownloadFileItem =
  | { kind: 'existing'; versionId: number; fileName: string | null; fileSize: number }
  | { kind: 'new'; file: File }

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

  // ── 다운로드 파일 (멀티 파일 — 이미지처럼 추가/X, 저장 시 반영) ──
  const [downloadFiles, setDownloadFiles] = useState<DownloadFileItem[]>([])
  const [removedVersionIds, setRemovedVersionIds] = useState<number[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsError, setVersionsError] = useState(false)
  const versionInputRef = useRef<HTMLInputElement>(null)

  /** 현재 등록된 다운로드 파일 로드 — 실패 시 versionsError로 구분. */
  const loadDownloadFiles = useCallback(async () => {
    setVersionsLoading(true)
    setVersionsError(false)
    try {
      const vres = await assetApi.getVersions(assetId)
      setDownloadFiles(vres.data.data.map(v => ({
        kind: 'existing' as const, versionId: v.versionId, fileName: v.fileName, fileSize: v.fileSize,
      })))
      setRemovedVersionIds([])
    } catch {
      setVersionsError(true)
    } finally {
      setVersionsLoading(false)
    }
  }, [assetId])

  const addDownloadFiles = (files: File[]) => {
    if (files.length === 0) return
    setDownloadFiles(prev => [...prev, ...files.map(file => ({ kind: 'new' as const, file }))])
  }

  const removeDownloadFile = (idx: number) => {
    // 상태 업데이터 밖에서 읽어 StrictMode 이중 실행에도 부작용이 중복되지 않게 함
    const item = downloadFiles[idx]
    // 기존 파일 제거는 저장 시 삭제하도록 표시(즉시 삭제 아님) — 중복 방지
    if (item?.kind === 'existing') {
      const vid = item.versionId
      setRemovedVersionIds(ids => (ids.includes(vid) ? ids : [...ids, vid]))
    }
    setDownloadFiles(prev => prev.filter((_, i) => i !== idx))
  }

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

        // 다운로드 파일 목록은 별도로 로드(에셋 정보 표시를 막지 않도록 await하지 않음)
        void loadDownloadFiles()
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
    let uploadedImageUrls: string[] = []
    let assetSaved = false
    try {
      // 새로 추가한 이미지만 업로드
      const newFiles = images.filter((i): i is Extract<ImageItem, { kind: 'new' }> => i.kind === 'new')
      if (newFiles.length > 0) {
        uploadedImageUrls = await fileApi.uploadImages(newFiles.map(i => i.file), 'assets/images')
      }

      // 기존 + 신규 URL을 순서대로 병합
      let uploadIdx = 0
      const finalUrls = images.map(item =>
        item.kind === 'existing' ? item.url : uploadedImageUrls[uploadIdx++]
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
      assetSaved = true

      // 다운로드 파일 반영 — 제거분 삭제. 성공분은 즉시 state에서 빼 중간 실패 후 재시도 시 중복 삭제 방지.
      for (const versionId of [...removedVersionIds]) {
        await assetApi.deleteVersion(assetId, versionId)
        setRemovedVersionIds(ids => ids.filter(id => id !== versionId))
      }
      // 추가분 업로드·등록(등록 실패 시 방금 올린 파일만 정리). 성공분은 즉시 목록에서 제거(재시도 중복 등록 방지).
      for (const item of downloadFiles.filter((f): f is Extract<DownloadFileItem, { kind: 'new' }> => f.kind === 'new')) {
        const url = await fileApi.uploadImage(item.file, 'assets/files')
        try {
          await assetApi.addVersion(assetId, {
            fileUrl: url, fileName: item.file.name, fileSize: item.file.size,
          })
        } catch (e) {
          await fileApi.deleteFiles([url]).catch(() => {})
          throw e
        }
        setDownloadFiles(prev => prev.filter(f => f !== item))
      }

      toast.success('에셋이 수정되었습니다.')
      navigate(`/assets/${res.data.data.assetId}`)
    } catch (err) {
      // 에셋 저장 전 실패면 업로드한 이미지 정리(저장 후엔 반영됐으므로 보존)
      if (!assetSaved && uploadedImageUrls.length > 0) {
        await fileApi.deleteFiles(uploadedImageUrls).catch(() => {})
      }
      toast.error(getErrorMessage(err, '에셋 수정에 실패했습니다.'))
    } finally {
      images.forEach(i => { if (i.kind === 'new') URL.revokeObjectURL(i.previewUrl) })
      setSubmitting(false)
    }
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
      <h1 className="text-2xl font-bold text-on-surface mb-8">에셋 수정</h1>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8">

        {/* ── 왼쪽: 폼 ── */}
        <div className="flex-1 flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">
              제목 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              className="w-full bg-surface-container border border-outline rounded-lg px-4 py-2 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-surface-container border border-outline rounded-lg px-4 py-2 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* 다운로드 파일 (멀티) — 이미지처럼 추가/X, "수정 완료" 시 반영 */}
          <div className="rounded-lg border p-5"
            style={{ borderColor: 'var(--color-outline)', background: 'var(--color-surface-container)' }}>
            <div className="text-base font-bold mb-1" style={{ color: 'var(--color-on-surface)' }}>다운로드 파일</div>
            <p className="text-sm mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              구매자가 받는 파일입니다. 여러 개 올릴 수 있고, <b>수정 완료</b> 시 반영됩니다.
            </p>

            {versionsLoading ? (
              <div role="status" aria-live="polite" className="text-sm py-1 mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>불러오는 중…</div>
            ) : versionsError ? (
              <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span>다운로드 파일을 불러오지 못했습니다.</span>
                <button type="button" onClick={loadDownloadFiles}
                  className="underline font-bold" style={{ color: 'var(--color-primary)' }}>다시 시도</button>
              </div>
            ) : downloadFiles.length > 0 ? (
              <ul className="flex flex-col gap-2 mb-3">
                {downloadFiles.map((f, idx) => {
                  const name = f.kind === 'existing' ? (f.fileName ?? '다운로드 파일') : f.file.name
                  const size = f.kind === 'existing' ? f.fileSize : f.file.size
                  return (
                    <li key={idx} className="flex items-center gap-3 rounded-lg p-3"
                      style={{ background: 'var(--color-surface-container-low)' }}>
                      <span className="material-symbols-outlined shrink-0" style={{ color: 'var(--color-primary)' }}>description</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate" style={{ color: 'var(--color-on-surface)' }}>{name}</div>
                        <div className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {formatFileSize(size)}{f.kind === 'new' && ' · 추가됨'}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeDownloadFile(idx)} aria-label={`${name} 제거`}
                        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-surface-container"
                        style={{ color: 'var(--color-error)' }}>
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>등록된 다운로드 파일이 없습니다.</p>
            )}

            {/* 파일 추가 — 네이티브 버튼 숨기고 커스텀 버튼(여러 개 선택 가능) */}
            <label htmlFor="version-file"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold cursor-pointer border transition-colors hover:bg-surface-container-low"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
              <span className="material-symbols-outlined text-base">upload</span>
              파일 추가
            </label>
            <input id="version-file" ref={versionInputRef} type="file" multiple className="hidden"
              aria-label="다운로드 파일 선택"
              onChange={e => { if (e.target.files) addDownloadFiles(Array.from(e.target.files)); e.target.value = '' }} />
          </div>

          {/* 무료/유료 */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">가격 설정</label>
            <div className="flex gap-3 mb-3">
              <button type="button" onClick={() => setIsFree(true)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  isFree ? 'bg-success text-background' : 'bg-surface-container border border-outline text-on-surface-variant hover:border-success'
                }`}>무료</button>
              <button type="button" onClick={() => setIsFree(false)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  !isFree ? 'bg-warning text-background' : 'bg-surface-container border border-outline text-on-surface-variant hover:border-warning'
                }`}>유료</button>
            </div>
            {!isFree && (
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant">₩</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} min={0}
                  placeholder="가격 입력"
                  className="flex-1 bg-surface-container border border-outline rounded-lg px-4 py-2 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary" />
              </div>
            )}
          </div>

          {/* 카테고리 / 라이선스 */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-on-surface mb-1">카테고리</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="w-full bg-surface-container border border-outline rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary">
                <option value="">선택 안 함</option>
                {categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name}</option>))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-on-surface mb-1">라이선스</label>
              <select value={licenseTypeId} onChange={e => setLicenseTypeId(e.target.value)}
                className="w-full bg-surface-container border border-outline rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary">
                <option value="">선택 안 함</option>
                {licenseTypes.map(l => (<option key={l.licenseTypeId} value={l.licenseTypeId}>{l.name}</option>))}
              </select>
            </div>
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">
              태그 <span className="text-on-surface-variant text-xs">(최대 10개, 입력 시 자동완성)</span>
            </label>
            <TagInput tags={selectedTags} onChange={setSelectedTags} max={10} />
          </div>
        </div>

        {/* ── 오른쪽: 미리보기 이미지 + 제출 ── */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <label className="block text-sm font-medium text-on-surface">
            미리보기 이미지 <span className="text-error">*</span>
            <span className="text-on-surface-variant text-xs ml-1">({images.length}/{MAX_IMAGES})</span>
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
              dragging ? 'border-primary bg-primary/10' : 'border-outline hover:border-outline-strong bg-surface-container'
            } ${images.length >= MAX_IMAGES ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <span className={`material-symbols-outlined text-4xl mb-2 ${dragging ? 'text-primary' : 'text-on-surface-variant'}`}>add_photo_alternate</span>
            <p className="text-on-surface-variant text-sm text-center">
              이미지를 드래그하거나 클릭하여 추가<br />
              <span className="text-on-surface-variant text-xs">PNG, JPG, GIF (최대 {MAX_IMAGES}장)</span>
            </p>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative group aspect-square">
                  <img src={previewOf(img)} alt={`preview-${idx}`} className="w-full h-full object-cover rounded-lg" />
                  {idx === 0 && <span className="absolute top-1 left-1 text-xs bg-primary text-on-primary px-1 rounded">대표</span>}
                  <button type="button" onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-error text-on-primary rounded-full text-xs hidden group-hover:flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 mt-auto">
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-xl font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {submitting ? '수정 중...' : '수정 완료'}
            </button>
            <button type="button" onClick={() => navigate(`/assets/${assetId}`)}
              className="w-full py-2.5 rounded-xl text-sm text-on-surface-variant border border-outline hover:bg-surface-container transition-colors">
              취소
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
