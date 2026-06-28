import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { commissionApi, type CommissionResponse } from '../api/commissionApi'
import { fileApi } from '../api/fileApi'
import CommissionChat from '../components/CommissionChat'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'
import { validateFilesSize } from '../lib/fileValidation'

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: '작업 중',
  REVIEW:      '검토 중',
  COMPLETED:   '완료',
  CANCELLED:   '취소됨',
}
const STATUS_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  IN_PROGRESS: { bg: 'rgba(240,136,62,0.1)',  color: '#f0883e', border: 'rgba(240,136,62,0.3)' },
  REVIEW:      { bg: 'rgba(129,140,248,0.1)', color: '#818cf8', border: 'rgba(129,140,248,0.3)' },
  COMPLETED:   { bg: 'rgba(63,185,80,0.1)',   color: '#3fb950', border: 'rgba(63,185,80,0.3)' },
  CANCELLED:   { bg: 'rgba(248,81,73,0.1)',   color: '#f85149', border: 'rgba(248,81,73,0.3)' },
}

const TYPE_LABEL: Record<string, string> = {
  SERVICE_OPTION: '서비스형 (가격 고정)',
  SERVICE_QUOTE:  '서비스형 (가격 협의)',
  REQUEST:        '의뢰형',
}

export default function CommissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user: me } = useAuthStore()
  const navigate = useNavigate()

  const [commission, setCommission] = useState<CommissionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUploading, setPreviewUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [activePreview, setActivePreview] = useState(0)   // 캐러셀 현재 인덱스
  const [lightboxOpen, setLightboxOpen] = useState(false) // 미리보기 확대
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewInputRef = useRef<HTMLInputElement>(null)
  const lightboxRef = useRef<HTMLDivElement>(null)
  const lightboxCloseRef = useRef<HTMLButtonElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!id) return
    const commissionId = Number(id)
    if (isNaN(commissionId)) { setNotFound(true); setLoading(false); return }
    commissionApi.getCommission(commissionId)
      .then(res => setCommission(res.data.data))
      .catch(err => {
        const status = getErrorStatus(err)
        if (status === 403) navigate('/403', { replace: true })
        else if (status && status >= 500) navigate('/500', { replace: true })
        else setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id])

  // 작가: 작업물 전달 완료 → 검토 요청 (IN_PROGRESS → REVIEW)
  const handleRequestReview = async () => {
    if (!commission) return
    if (commission.deliveryFiles.length === 0 || commission.previewImages.length === 0) {
      toast.error('납품 파일과 미리보기 이미지를 모두 업로드해주세요.'); return
    }
    setActionLoading(true)
    try {
      const res = await commissionApi.updateStatus(commission.commissionId, 'REVIEW')
      setCommission(res.data.data)
      toast.success('검토 요청을 보냈습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '상태 변경에 실패했습니다.'))
    } finally {
      setActionLoading(false)
    }
  }

  // 의뢰자: 결과물 확인 → 완료 확정 (REVIEW → COMPLETED)
  const handleConfirmComplete = async () => {
    if (!commission) return
    if (!confirm('작업물을 확인하셨나요? 완료 확정 시 거래가 종료됩니다.')) return
    setActionLoading(true)
    try {
      const res = await commissionApi.updateStatus(commission.commissionId, 'COMPLETED')
      setCommission(res.data.data)
      toast.success('거래가 완료되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '완료 처리에 실패했습니다.'))
    } finally {
      setActionLoading(false)
    }
  }

  // 작가: 납품 파일 업로드 (R2 → 커미션 파일 등록). 여러 개 선택 시 순차 업로드(누적)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0 || !commission) return
    if (!validateFilesSize(files)) return
    setUploading(true)
    try {
      let updated = commission
      let succeeded = 0
      for (const file of files) {
        let uploadedUrl: string | null = null
        try {
          uploadedUrl = await fileApi.uploadImage(file, `commissions/${commission.commissionId}/files`)
          const res = await commissionApi.uploadFile(commission.commissionId, {
            fileType: 'FINAL',
            fileUrl: uploadedUrl,
            fileName: file.name,
            fileSize: file.size,
          })
          updated = res.data.data
          succeeded++
        } catch (err) {
          // R2 업로드는 됐으나 메타 등록 실패 시 고아 파일 정리
          if (uploadedUrl) await fileApi.deleteFiles([uploadedUrl]).catch(() => {})
          toast.error(getErrorMessage(err, `${file.name} 업로드에 실패했습니다.`))
        }
      }
      if (succeeded > 0) {
        setCommission(updated)
        toast.success(`납품 파일 ${succeeded}개가 업로드되었습니다.`)
      }
    } finally {
      setUploading(false)
    }
  }

  // 작가: 검토용 미리보기 이미지 업로드 (여러 장, 서버가 각각 워터마크+축소 → 행 추가)
  const handlePreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0 || !commission) return
    if (files.some(f => !f.type.startsWith('image/'))) {
      toast.error('미리보기는 이미지 파일만 가능합니다.'); return
    }
    if (!validateFilesSize(files)) return
    setPreviewUploading(true)
    try {
      const res = await commissionApi.uploadPreviews(commission.commissionId, files)
      setCommission(res.data.data)
      toast.success(`미리보기 ${files.length}장이 업로드되었습니다.`)
    } catch (err) {
      toast.error(getErrorMessage(err, '미리보기 업로드에 실패했습니다.'))
    } finally {
      setPreviewUploading(false)
    }
  }

  // 작가: 미리보기 1장 삭제
  const handleDeletePreview = async (previewImageId: number) => {
    if (!commission) return
    setPreviewUploading(true)
    try {
      const res = await commissionApi.deletePreview(commission.commissionId, previewImageId)
      setCommission(res.data.data)
      setActivePreview(0)
      toast.success('미리보기를 삭제했습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '미리보기 삭제에 실패했습니다.'))
    } finally {
      setPreviewUploading(false)
    }
  }

  // 라이트박스: ESC 닫기 + 배경 스크롤 잠금 + 포커스 트랩/복원(접근성)
  useEffect(() => {
    if (!lightboxOpen) return
    // 트리거 요소 기억(닫을 때 복원)
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLightboxOpen(false); return }
      if (e.key !== 'Tab' || !lightboxRef.current) return
      // Tab 포커스를 모달 내부로 가둠
      const focusable = lightboxRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    queueMicrotask(() => lightboxCloseRef.current?.focus())   // 열리면 모달로 포커스 이동
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      lastFocusedRef.current?.focus()   // 닫히면 트리거로 복원
    }
  }, [lightboxOpen])

  // 원본 다운로드 — cross-origin(R2)이라 <a download>는 무시됨 → blob으로 받아 강제 저장, 실패 시 새 탭 폴백
  const handleDownloadOriginal = async (fileUrl: string, fileName?: string) => {
    if (!commission || downloading) return   // 진행 중 더블클릭 방지
    // 클릭 직후(사용자 활성화 유효) 빈 탭을 선점 — fetch 실패 시 팝업 차단 없이 이 탭으로 폴백.
    // noopener를 주면 핸들이 null이 되므로 빼고, 대신 opener를 수동으로 끊어 보안 유지.
    const fallbackTab = window.open('', '_blank')
    setDownloading(true)
    try {
      const res = await fetch(fileUrl)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // 파일명: 응답값 우선, 없으면 URL 경로 끝에서 추출, 그래도 없으면 폴백
      const name = fileName || decodeURIComponent(fileUrl.split('?')[0].split('/').pop() || '')
      a.download = name || `commission_${commission.commissionId}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      fallbackTab?.close()   // blob 저장 성공 → 선점 탭 불필요
    } catch {
      if (fallbackTab) {
        fallbackTab.opener = null
        fallbackTab.location.href = fileUrl
      } else {
        window.open(fileUrl, '_blank', 'noopener')   // 선점 실패 시 최후 폴백
      }
    } finally {
      setDownloading(false)
    }
  }

  // 작가: 납품 파일 1개 삭제
  const handleDeleteFile = async (fileId: number) => {
    if (!commission) return
    setUploading(true)
    try {
      const res = await commissionApi.deleteFile(commission.commissionId, fileId)
      setCommission(res.data.data)
      toast.success('납품 파일을 삭제했습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '납품 파일 삭제에 실패했습니다.'))
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = async () => {
    if (!commission) return
    if (!confirm('계약을 취소하시겠습니까?')) return
    setActionLoading(true)
    try {
      await commissionApi.cancel(commission.commissionId)
      // status만 바꾸면 진행 기록 타임라인에 '취소' 단계가 안 떠서 cancelledAt도 함께 채움
      // (클라 시각 — 새로고침 시 서버값으로 정확해짐)
      setCommission(prev => prev ? { ...prev, status: 'CANCELLED', cancelledAt: new Date().toISOString() } : prev)
      toast.success('계약이 취소되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '취소에 실패했습니다.'))
    } finally {
      setActionLoading(false)
    }
  }

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0d1117' }}>
        <div className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent"
          style={{ borderColor: '#2f81f7' }} />
      </div>
    )
  }

  /* ── 미존재 ── */
  if (notFound || !commission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4"
        style={{ background: '#0d1117', color: '#e6edf3' }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: '#30363d' }}>inbox</span>
        <p style={{ color: '#7d8590' }}>존재하지 않는 계약입니다.</p>
        <Link to="/mypage" className="text-sm font-bold" style={{ color: '#2f81f7' }}>마이페이지로</Link>
      </div>
    )
  }

  const sc = STATUS_COLOR[commission.status] ?? STATUS_COLOR.IN_PROGRESS
  const isClient = me?.userId === commission.clientId
  const isArtist = me?.userId === commission.artistId
  const canUploadFile = isArtist && (commission.status === 'IN_PROGRESS' || commission.status === 'REVIEW')
  const deliveryFiles = commission.deliveryFiles ?? []
  const previews = commission.previewImages ?? []
  const currentIndex = previews.length ? Math.min(activePreview, previews.length - 1) : 0
  const current = previews.length ? previews[currentIndex] : null
  const movePreview = (delta: number) =>
    setActivePreview(i => (i + delta + previews.length) % previews.length)
  const canRequestReview = isArtist && commission.status === 'IN_PROGRESS'
  const canConfirmComplete = isClient && commission.status === 'REVIEW'
  const canCancel = (isClient || isArtist) && commission.status === 'IN_PROGRESS'
  const dDay = commission.agreedDeadline
    ? Math.ceil((new Date(commission.agreedDeadline).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div style={{ background: '#0d1117', color: '#e6edf3', minHeight: '100vh' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">

        {/* 브레드크럼 */}
        <div className="flex items-center gap-1.5 mb-6 text-sm" style={{ color: '#7d8590' }}>
          <Link to="/mypage" className="hover:text-white transition-colors">마이페이지</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span style={{ color: '#e6edf3' }}>계약 #{commission.commissionId}</span>
        </div>

        {/* 진행 스텝퍼 */}
        {commission.status === 'CANCELLED' ? (
          <div className="mb-8 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(248,81,73,0.1)', color: '#f85149' }}>
            <span className="material-symbols-outlined text-base">cancel</span>
            취소된 계약입니다
          </div>
        ) : (
          <div className="mb-8 flex items-center">
            {(['IN_PROGRESS', 'REVIEW', 'COMPLETED'] as const).map((key, i, arr) => {
              const cur = arr.indexOf(commission.status as typeof arr[number])
              const label = key === 'IN_PROGRESS' ? '작업 중' : key === 'REVIEW' ? '검토' : '완료'
              const done = cur >= 0 && i <= cur
              return (
                <div key={key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={done
                        ? { background: '#2f81f7', color: '#fff' }
                        : { background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className="text-xs font-bold" style={{ color: done ? '#e6edf3' : '#7d8590' }}>{label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2" style={{ background: cur > i ? '#2f81f7' : '#30363d' }} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ===== 좌측 메인 ===== */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* 상태 + 제목 */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-bold border"
                  style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>
                  {STATUS_LABEL[commission.status]}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold"
                  style={{ background: '#21262d', color: '#7d8590' }}>
                  {TYPE_LABEL[commission.commissionType] ?? commission.commissionType}
                </span>
                {dDay !== null && (
                  <span className="text-xs font-bold"
                    style={{ color: dDay <= 3 ? '#f85149' : '#7d8590' }}>
                    {dDay > 0 ? `마감까지 D-${dDay}` : dDay === 0 ? 'D-Day' : '마감'}
                  </span>
                )}
              </div>
              {/* 거래 스냅샷 제목 — 무슨 작업이었는지. 옛 거래(스냅샷 이전)는 계약 번호로 폴백 */}
              <h1 className="text-2xl font-bold">{commission.title ?? `계약 #${commission.commissionId}`}</h1>
            </div>

            {/* 의뢰자 / 작가 카드 */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: '의뢰자', nickname: commission.clientNickname },
                { label: '담당 작가', nickname: commission.artistNickname },
              ].map(({ label, nickname }) => (
                <div key={label} className="flex items-center gap-3 p-4 rounded-2xl border"
                  style={{ background: '#161b22', borderColor: '#30363d' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#2f81f7,#6366f1)', color: '#fff' }}>
                    {(nickname ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: '#7d8590' }}>{label}</div>
                    {nickname ? (
                      <Link to={`/profile/${nickname}`}
                        className="font-bold text-sm hover:text-[#2f81f7] transition-colors">
                        @{nickname}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold" style={{ color: '#7d8590' }}>미정</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 의뢰 내용 — 거래 스냅샷(원글이 수정·삭제돼도 당시 내용 보존) */}
            {commission.description && (
              <div className="p-5 rounded-2xl border" style={{ background: '#161b22', borderColor: '#30363d' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7d8590' }}>의뢰 내용</div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#e6edf3' }}>
                  {commission.description}
                </p>
              </div>
            )}

            {/* 채팅 (Phase 3-a: REST 기반. 실시간 푸시는 3-b WebSocket 예정) */}
            <CommissionChat
              commissionId={commission.commissionId}
              meId={me?.userId}
              readOnly={commission.status === 'COMPLETED' || commission.status === 'CANCELLED'}
            />

            {/* 완료일 */}
            {commission.completedAt && (
              <div className="flex items-center gap-2 text-sm p-4 rounded-2xl"
                style={{ background: 'rgba(63,185,80,0.05)', border: '1px solid rgba(63,185,80,0.2)', color: '#3fb950' }}>
                <span className="material-symbols-outlined text-base">check_circle</span>
                {new Date(commission.completedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 완료
              </div>
            )}

          </div>

          {/* ===== 우측 사이드바 ===== */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="sticky top-20 rounded-2xl border p-5 space-y-4"
              style={{ background: '#161b22', borderColor: '#30363d' }}>

              {/* 합의 금액 */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#7d8590' }}>합의 금액</div>
                <div className="text-2xl font-bold">₩{Number(commission.agreedPrice).toLocaleString()}</div>
              </div>

              <div className="h-px" style={{ background: '#30363d' }} />

              {/* 합의 마감일 */}
              {commission.agreedDeadline && (
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#7d8590' }}>합의 마감일</span>
                  <span className="font-bold">
                    {new Date(commission.agreedDeadline).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}

              {/* 상태 */}
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#7d8590' }}>상태</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>
                  {STATUS_LABEL[commission.status]}
                </span>
              </div>

              <div className="h-px" style={{ background: '#30363d' }} />

              {/* 진행 타임라인 — 단계 전이 시각(수락→검토요청→완료/취소). 발생한 단계만 표시 */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7d8590' }}>진행 기록</div>
                {([
                  { label: '수락', at: commission.createdAt },
                  { label: '검토 요청', at: commission.reviewRequestedAt },
                  { label: '완료', at: commission.completedAt },
                  { label: '취소', at: commission.cancelledAt },
                ] as const).filter(s => s.at).map(s => (
                  <div key={s.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2" style={{ color: '#7d8590' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.label === '취소' ? '#f85149' : '#2f81f7' }} />
                      {s.label}
                    </span>
                    <span className="font-bold text-xs">
                      {new Date(s.at as string).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>

              {/* 작업물 — 미리보기(워터마크)는 모두에게, 원본은 작가/완료 후에만 */}
              {(previews.length > 0 || deliveryFiles.length > 0 || canUploadFile) && (
                <>
                  <div className="h-px" style={{ background: '#30363d' }} />
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7d8590' }}>작업물</div>

                    {/* 워터마크 미리보기 — 다중 캐러셀 + 클릭 확대(라이트박스) */}
                    {current && (
                      <div>
                        <div className="relative">
                          <button type="button" onClick={() => setLightboxOpen(true)}
                            className="block w-full cursor-zoom-in" aria-label="미리보기 크게 보기">
                            <img src={current.imageUrl} alt={`미리보기 ${currentIndex + 1}`}
                              className="w-full rounded-lg" style={{ border: '1px solid #30363d' }} />
                          </button>
                          {previews.length > 1 && (
                            <>
                              <button type="button" onClick={() => movePreview(-1)} aria-label="이전 미리보기"
                                className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white">
                                <span className="material-symbols-outlined text-lg">chevron_left</span>
                              </button>
                              <button type="button" onClick={() => movePreview(1)} aria-label="다음 미리보기"
                                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white">
                                <span className="material-symbols-outlined text-lg">chevron_right</span>
                              </button>
                              <div className="absolute bottom-1 right-2 px-2 py-0.5 rounded-full text-xs bg-black/60 text-white">
                                {currentIndex + 1} / {previews.length}
                              </div>
                            </>
                          )}
                        </div>

                        {/* 썸네일 스트립 (2장 이상) */}
                        {previews.length > 1 && (
                          <div className="flex gap-1.5 mt-2 overflow-x-auto">
                            {previews.map((p, i) => (
                              <button key={p.previewImageId} type="button" onClick={() => setActivePreview(i)}
                                className="shrink-0 w-12 h-12 rounded overflow-hidden"
                                style={{ border: i === currentIndex ? '2px solid #2f81f7' : '1px solid #30363d' }}>
                                <img src={p.imageUrl} alt={`미리보기 ${i + 1} 썸네일`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}

                        <p className="text-xs mt-1" style={{ color: '#7d8590' }}>
                          워터마크 미리보기{!isArtist ? ' · 완료 확정 후 원본을 받을 수 있습니다' : ''}
                        </p>
                      </div>
                    )}

                    {/* 원본 납품 파일(다중) — 역할/상태로 잠금 강제(작가 또는 완료). 백엔드 마스킹 + UI 이중 방어 */}
                    {deliveryFiles.length > 0 && (isArtist || commission.status === 'COMPLETED') ? (
                      <div className="space-y-1.5">
                        {deliveryFiles.map(f => (
                          <div key={f.fileId} className="flex items-center gap-2">
                            <button type="button" onClick={() => handleDownloadOriginal(f.fileUrl, f.fileName)} disabled={downloading}
                              className="flex items-center gap-1.5 text-sm font-bold hover:underline disabled:opacity-50 min-w-0"
                              style={{ color: '#2f81f7' }}>
                              <span className="material-symbols-outlined text-base">download</span>
                              <span className="truncate">{f.fileName || '원본 다운로드'}</span>
                            </button>
                            {canUploadFile && (
                              <button type="button" onClick={() => handleDeleteFile(f.fileId)} disabled={uploading}
                                aria-label={`${f.fileName} 삭제`}
                                className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-[#21262d] disabled:opacity-50" style={{ color: '#f85149' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : !isArtist && previews.length > 0 ? (
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#7d8590' }}>
                        <span className="material-symbols-outlined text-base" style={{ color: '#484f58' }}>lock</span>
                        완료 확정 전까지 원본은 잠겨 있습니다.
                      </div>
                    ) : previews.length === 0 && !canUploadFile ? (
                      <p className="text-xs" style={{ color: '#7d8590' }}>작가가 작업물을 전달하면 표시됩니다.</p>
                    ) : null}

                    {/* 작가: 원본 + 미리보기 업로드 (검토 요청엔 둘 다 필요) */}
                    {canUploadFile && (
                      <div className="space-y-2 pt-1">
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[#1c2128] disabled:opacity-50"
                          style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
                          <span className="material-symbols-outlined text-base">upload_file</span>
                          {uploading ? '업로드 중...' : deliveryFiles.length > 0 ? '납품 파일(원본) 추가' : '납품 파일(원본) 업로드'}
                        </button>
                        <input ref={previewInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePreviewUpload} />
                        <button type="button" onClick={() => previewInputRef.current?.click()} disabled={previewUploading}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[#1c2128] disabled:opacity-50"
                          style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
                          <span className="material-symbols-outlined text-base">image</span>
                          {previewUploading ? '처리 중...' : previews.length > 0 ? '미리보기 이미지 추가' : '미리보기 이미지 업로드 (필수)'}
                        </button>

                        {/* 작가 전용: 업로드된 미리보기 썸네일 + 개별 삭제 */}
                        {previews.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {previews.map((p, i) => (
                              <div key={p.previewImageId} className="relative w-14 h-14 rounded overflow-hidden" style={{ border: '1px solid #30363d' }}>
                                <img src={p.imageUrl} alt={`미리보기 ${i + 1}`} className="w-full h-full object-cover" />
                                <button type="button" onClick={() => handleDeletePreview(p.previewImageId)} disabled={previewUploading}
                                  aria-label={`미리보기 ${i + 1} 삭제`}
                                  className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-black/70 hover:bg-black/90 text-white disabled:opacity-50">
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {(deliveryFiles.length === 0 || previews.length === 0) && (
                          <p className="text-xs" style={{ color: '#f0883e' }}>
                            검토 요청하려면 납품 파일과 미리보기 이미지를 모두 올려야 합니다.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="h-px" style={{ background: '#30363d' }} />

              {/* 액션 버튼 */}
              {commission.status !== 'CANCELLED' && commission.status !== 'COMPLETED' && (
                <div className="space-y-2">
                  {canRequestReview && (
                    <button onClick={handleRequestReview} disabled={actionLoading}
                      className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#2f81f7', color: '#fff', boxShadow: '0 4px 16px rgba(47,129,247,0.3)' }}>
                      {actionLoading ? '처리 중...' : '검토 요청'}
                    </button>
                  )}
                  {canConfirmComplete && (
                    <button onClick={handleConfirmComplete} disabled={actionLoading}
                      className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#3fb950', color: '#fff', boxShadow: '0 4px 16px rgba(63,185,80,0.3)' }}>
                      {actionLoading ? '처리 중...' : '완료 확정'}
                    </button>
                  )}
                  {/* 작가가 검토 요청을 보낸 뒤 의뢰자 확인 대기 안내 */}
                  {isArtist && commission.status === 'REVIEW' && (
                    <p className="text-xs text-center py-2" style={{ color: '#7d8590' }}>
                      의뢰자의 완료 확정을 기다리는 중입니다.
                    </p>
                  )}
                  {canCancel && (
                    <button onClick={handleCancel} disabled={actionLoading}
                      className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-[#1c2128] disabled:opacity-50"
                      style={{ border: '1px solid #30363d', color: '#f85149' }}>
                      <span className="material-symbols-outlined text-base">cancel</span>
                      {actionLoading ? '처리 중...' : '계약 취소'}
                    </button>
                  )}
                </div>
              )}

              {commission.status === 'COMPLETED' && (
                <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(63,185,80,0.1)', color: '#3fb950' }}>
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  거래 완료
                </div>
              )}

              {commission.status === 'CANCELLED' && (
                <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(248,81,73,0.1)', color: '#f85149' }}>
                  <span className="material-symbols-outlined text-base">cancel</span>
                  취소된 계약
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 미리보기 라이트박스 */}
      {lightboxOpen && current && (
        <div ref={lightboxRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)} role="dialog" aria-modal="true" aria-label="미리보기 확대">
          <button ref={lightboxCloseRef} type="button" onClick={() => setLightboxOpen(false)} aria-label="닫기"
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
          {previews.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); movePreview(-1) }} aria-label="이전 미리보기"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white">
                <span className="material-symbols-outlined text-2xl">chevron_left</span>
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); movePreview(1) }} aria-label="다음 미리보기"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white">
                <span className="material-symbols-outlined text-2xl">chevron_right</span>
              </button>
            </>
          )}
          <img src={current.imageUrl} alt={`미리보기 ${currentIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
          {previews.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-sm bg-black/60 text-white">
              {currentIndex + 1} / {previews.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
