import { useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { userApi, type UserProfileResponse } from '../../api/userApi'
import { toast } from '../../store/toastStore'
import { getErrorMessage } from '../../lib/errorUtils'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '../../lib/fileValidation'
import { cropToBlob, isPossiblyAnimated, MAX_PROFILE_IMAGE_BYTES, PROFILE_IMAGE_TYPES } from '../../lib/imageCrop'

interface ProfileImageFieldProps {
  imageUrl: string | null
  nickname: string
  /** 업로드·삭제 성공 시 서버가 돌려준 최신 프로필 */
  onChanged: (profile: UserProfileResponse) => void
  /** 자르는 중·업로드 중이면 true — 부모 모달이 그동안 닫히지 않게 */
  onBusyChange?: (busy: boolean) => void
}

/**
 * 프로필 편집 모달의 사진 영역.
 * 파일 선택 → 정사각형 범위 지정(react-easy-crop) → 적용 시 브라우저에서 잘라 바로 업로드.
 * 폼의 '저장' 버튼과 별개로 동작(사진은 전용 API).
 */
export default function ProfileImageField({ imageUrl, nickname, onChanged, onBusyChange }: ProfileImageFieldProps) {
  const [source, setSource] = useState<{ url: string; type: string } | null>(null)   // 자르는 중인 원본
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = source !== null || uploading
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])

  // 원본 미리보기용 Object URL 정리
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url) }, [source])

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''   // 같은 파일 다시 선택 가능하게
    if (!file) return
    setError('')
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setError('PNG, JPEG, GIF, WebP 이미지만 사용할 수 있습니다.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`원본 이미지는 ${MAX_UPLOAD_MB}MB 이하만 불러올 수 있습니다.`)
      return
    }
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setArea(null)
    setSource({ url: URL.createObjectURL(file), type: file.type })
  }

  const cancelCrop = () => {
    setSource(null)
    setError('')
  }

  const applyCrop = async () => {
    if (!source || !area || uploading) return
    setUploading(true)
    setError('')
    try {
      const { blob, filename } = await cropToBlob(source.url, area, source.type)
      if (blob.size > MAX_PROFILE_IMAGE_BYTES) {
        setError('잘라낸 이미지가 2MB를 넘습니다. 범위를 줄이거나 다른 이미지를 사용해 주세요.')
        return
      }
      const res = await userApi.uploadProfileImage(blob, filename)
      onChanged(res.data.data)
      setSource(null)
      toast.success('프로필 사진을 변경했습니다.')
    } catch (err) {
      setError(getErrorMessage(err, '프로필 사진 업로드에 실패했습니다.'))
    } finally {
      setUploading(false)
    }
  }

  const removeImage = async () => {
    if (uploading) return
    setUploading(true)
    setError('')
    try {
      const res = await userApi.removeProfileImage()
      onChanged(res.data.data)
      toast.success('프로필 사진을 삭제했습니다.')
    } catch (err) {
      setError(getErrorMessage(err, '프로필 사진 삭제에 실패했습니다.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <p className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>프로필 사진</p>

      {source ? (
        // ── 범위 지정 ──
        <div>
          <div className="relative w-full h-64 rounded-xl overflow-hidden" style={{ background: 'var(--color-background)' }}>
            <Cropper
              image={source.url}
              crop={crop}
              zoom={zoom}
              aspect={1}
              minZoom={1}
              maxZoom={5}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          </div>
          <label className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            <span className="shrink-0">확대</span>
            <input type="range" min={1} max={5} step={0.05} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1" aria-label="확대 비율" />
          </label>
          {isPossiblyAnimated(source.type) && (
            <p className="text-xs mt-2" style={{ color: 'var(--color-warning)' }}>
              움직이는 이미지(GIF 등)는 재생되지 않고, 첫 장면만 정지 이미지로 저장됩니다.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={cancelCrop} disabled={uploading}
              className="flex-1 py-2 rounded-xl text-sm font-bold hover:bg-surface-container transition-colors disabled:opacity-50"
              style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
              취소
            </button>
            <button type="button" onClick={applyCrop} disabled={uploading || !area}
              className="flex-1 py-2 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              {uploading ? '업로드 중...' : '적용'}
            </button>
          </div>
        </div>
      ) : (
        // ── 현재 사진 + 변경/삭제 ──
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center font-bold text-xl shrink-0"
            style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))', color: '#fff' }}>
            {imageUrl
              ? <img src={imageUrl} alt={`${nickname} 프로필 사진`} className="w-full h-full object-cover" />
              : nickname.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-surface-container transition-colors disabled:opacity-50"
                style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                사진 변경
              </button>
              {imageUrl && (
                <button type="button" onClick={removeImage} disabled={uploading}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-surface-container transition-colors disabled:opacity-50"
                  style={{ border: '1px solid var(--color-outline)', color: 'var(--color-error)' }}>
                  {uploading ? '삭제 중...' : '사진 삭제'}
                </button>
              )}
            </div>
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>PNG·JPEG·GIF·WebP, 최대 2MB</span>
          </div>
          <input ref={inputRef} type="file" accept={PROFILE_IMAGE_TYPES.join(',')} className="hidden"
            aria-label="프로필 사진 파일 선택" onChange={handleSelect} />
        </div>
      )}

      {error && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--color-error)' }}>{error}</p>}
    </div>
  )
}
