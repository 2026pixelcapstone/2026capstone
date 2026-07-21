import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { assetApi, type AssetCategory, type AssetLicenseType } from '../api/assetApi'
import { fileApi } from '../api/fileApi'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'
import TagInput from '../components/TagInput'

const MAX_IMAGES = 5

interface ImageItem {
  file: File
  previewUrl: string
}

export default function AssetCreatePage() {
  const navigate = useNavigate()

  // 폼 상태
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
  const [assetFile, setAssetFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fileDragging, setFileDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 미리보기 이미지 ───────────────────────────────────────
  const addImages = useCallback((files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    setImages(prev => {
      const remaining = MAX_IMAGES - prev.length
      if (remaining <= 0) return prev
      const toAdd = imageFiles.slice(0, remaining).map(file => ({
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
      URL.revokeObjectURL(prev[idx].previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // ── 에셋 파일 ─────────────────────────────────────────────
  const handleAssetFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setFileDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setAssetFile(file)
  }

  const handleAssetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAssetFile(file)
    e.target.value = ''
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ── 제출 ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (images.length === 0) { toast.error('미리보기 이미지를 1장 이상 업로드해주세요.'); return }
    if (!assetFile) { toast.error('다운로드 파일을 업로드해주세요.'); return }
    if (!isFree && (!price || Number(price) <= 0)) { toast.error('유료 에셋의 가격을 입력해주세요.'); return }

    setSubmitting(true)
    let uploadedImageUrls: string[] = []
    let uploadedFileUrl: string | null = null
    try {
      // 1단계: 미리보기 이미지 R2 업로드
      uploadedImageUrls = await fileApi.uploadImages(
        images.map(img => img.file),
        'assets/images'
      )

      // 2단계: 에셋 파일 R2 업로드
      uploadedFileUrl = await fileApi.uploadImage(assetFile, 'assets/files')

      // 3단계: 에셋 생성
      const res = await assetApi.createAsset({
        title: title.trim(),
        description: description.trim() || undefined,
        isFree,
        price: isFree ? 0 : Number(price),
        categoryId: categoryId ? Number(categoryId) : undefined,
        licenseTypeId: licenseTypeId ? Number(licenseTypeId) : undefined,
        imageUrls: uploadedImageUrls,
        thumbnailUrl: uploadedImageUrls[0],
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        fileUrl: uploadedFileUrl,
        fileSize: assetFile.size,
      })

      toast.success('에셋이 등록되었습니다.')
      navigate(`/assets/${res.data.data.assetId}`)
    } catch (err) {
      // 업로드는 됐으나 생성 실패 시 R2 고아 파일 정리
      await fileApi.deleteFiles([...uploadedImageUrls, ...(uploadedFileUrl ? [uploadedFileUrl] : [])])
        .catch(() => {})
      toast.error(getErrorMessage(err, '에셋 등록에 실패했습니다.'))
    } finally {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl))
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-8">에셋 업로드</h1>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8">

        {/* ── 왼쪽: 폼 ── */}
        <div className="flex-1 flex flex-col gap-6">

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              placeholder="에셋 제목을 입력하세요"
              className="w-full bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="에셋에 대한 설명을 입력하세요 (포함 파일, 해상도, 사용 방법 등)"
              className="w-full bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* 다운로드 파일 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              다운로드 파일 <span className="text-red-400">*</span>
              <span className="text-gray-500 text-xs ml-1">PNG, ZIP, PSD 등</span>
            </label>
            {assetFile ? (
              <div className="flex items-center justify-between bg-surface-container border border-green-600 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📦</span>
                  <div>
                    <p className="text-white text-sm font-medium">{assetFile.name}</p>
                    <p className="text-gray-500 text-xs">{formatFileSize(assetFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssetFile(null)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                aria-label="다운로드 파일 업로드"
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                onDragOver={e => { e.preventDefault(); setFileDragging(true) }}
                onDragLeave={() => setFileDragging(false)}
                onDrop={handleAssetFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors h-32 ${
                  fileDragging
                    ? 'border-green-400 bg-green-900/20'
                    : 'border-gray-600 hover:border-gray-400 bg-surface-container'
                }`}
              >
                <div className="text-3xl mb-1">📦</div>
                <p className="text-gray-400 text-sm">파일을 드래그하거나 클릭하여 업로드</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleAssetFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* 무료/유료 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">가격 설정</label>
            <div className="flex gap-3 mb-3">
              <button
                type="button"
                onClick={() => setIsFree(true)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  isFree
                    ? 'bg-green-600 text-white'
                    : 'bg-surface-container border border-gray-600 text-gray-400 hover:border-green-500'
                }`}
              >
                무료
              </button>
              <button
                type="button"
                onClick={() => setIsFree(false)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  !isFree
                    ? 'bg-yellow-600 text-white'
                    : 'bg-surface-container border border-gray-600 text-gray-400 hover:border-yellow-500'
                }`}
              >
                유료
              </button>
            </div>
            {!isFree && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">₩</span>
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  min={0}
                  placeholder="가격 입력"
                  className="flex-1 bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                />
              </div>
            )}
          </div>

          {/* 카테고리 / 라이선스 */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">카테고리</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500">
                <option value="">선택 안 함</option>
                {categories.map(c => (
                  <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">라이선스</label>
              <select
                value={licenseTypeId}
                onChange={e => setLicenseTypeId(e.target.value)}
                className="w-full bg-surface-container border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500">
                <option value="">선택 안 함</option>
                {licenseTypes.map(l => (
                  <option key={l.licenseTypeId} value={l.licenseTypeId}>{l.name}</option>
                ))}
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
            aria-label="미리보기 이미지 업로드"
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
              이미지를 드래그하거나 클릭하여 업로드<br />
              <span className="text-gray-500 text-xs">PNG, JPG, GIF (최대 {MAX_IMAGES}장)</span>
            </p>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative group aspect-square">
                  <img src={img.previewUrl} alt={`preview-${idx}`} className="w-full h-full object-cover rounded-lg" />
                  {idx === 0 && <span className="absolute top-1 left-1 text-xs bg-blue-600 text-white px-1 rounded">대표</span>}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-auto"
          >
            {submitting ? '업로드 중...' : '에셋 등록'}
          </button>
        </div>
      </form>
    </div>
  )
}
