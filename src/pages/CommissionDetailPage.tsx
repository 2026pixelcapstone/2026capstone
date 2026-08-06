import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { commissionApi, type CommissionResponse } from '../api/commissionApi'
import CommissionChat from '../components/CommissionChat'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'
import { validateFilesSize } from '../lib/fileValidation'
import { downloadFileForced } from '../lib/download'
import CommissionReviewModal from '../components/CommissionReviewModal'
import { startCommissionPayment } from '../lib/toss'

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: '결제 대기',
  IN_PROGRESS: '작업 중',
  REVIEW:      '검토 중',
  COMPLETED:   '완료',
  CANCELLED:   '취소됨',
}
const STATUS_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  PENDING_PAYMENT: { bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', color: 'var(--color-warning)', border: 'color-mix(in srgb, var(--color-warning) 30%, transparent)' },
  IN_PROGRESS: { bg: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',    color: 'var(--color-accent)',    border: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' },
  REVIEW:      { bg: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)', color: 'var(--color-secondary)', border: 'color-mix(in srgb, var(--color-secondary) 30%, transparent)' },
  COMPLETED:   { bg: 'color-mix(in srgb, var(--color-success) 10%, transparent)',   color: 'var(--color-success)', border: 'color-mix(in srgb, var(--color-success) 30%, transparent)' },
  CANCELLED:   { bg: 'color-mix(in srgb, var(--color-error) 10%, transparent)',   color: 'var(--color-error)', border: 'color-mix(in srgb, var(--color-error) 30%, transparent)' },
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
  const [paying, setPaying] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [activePreview, setActivePreview] = useState(0)   // 캐러셀 현재 인덱스
  const [lightboxOpen, setLightboxOpen] = useState(false) // 미리보기 확대
  const [reviewOpen, setReviewOpen] = useState(false)     // 리뷰 작성/수정 모달
  const [hasReviewed, setHasReviewed] = useState(false)   // 내가 이미 리뷰를 남겼는지(버튼 라벨)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // 완료 거래 + 내가 의뢰자면 이미 리뷰했는지 조회 (버튼 라벨: 남기기 vs 수정)
  useEffect(() => {
    if (!commission || commission.status !== 'COMPLETED' || me?.userId !== commission.clientId) {
      setHasReviewed(false)
      return
    }
    let ignore = false
    commissionApi.getMyReview(commission.commissionId)
      .then(res => { if (!ignore) setHasReviewed(!!res.data.data) })
      .catch(() => { if (!ignore) setHasReviewed(false) })
    return () => { ignore = true }
  }, [commission, me?.userId])

  // 작가: 작업물 전달 완료 → 검토 요청 (IN_PROGRESS → REVIEW)
  const handleRequestReview = async () => {
    if (!commission) return
    // 미리보기는 원본 업로드 시 자동 생성되므로 납품 파일만 필수(백엔드 게이트와 일치)
    if (commission.deliveryFiles.length === 0) {
      toast.error('납품 파일을 1개 이상 업로드해주세요.'); return
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

  // 작가: 납품 파일 업로드 (멀티파트, 서버 경유) — "원본 = 미리보기" 재설계.
  // 서버가 원본을 R2에 저장하고, 이미지면 워터마크 미리보기를 자동 생성(gif=첫 프레임).
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0 || !commission) return
    if (files.length > 5) {
      toast.error('한 번에 최대 5개까지 업로드할 수 있습니다.'); return   // 서버 상한과 일치
    }
    if (!validateFilesSize(files)) return
    setUploading(true)
    try {
      const res = await commissionApi.uploadFiles(commission.commissionId, files)
      setCommission(res.data.data)
      toast.success(`납품 파일 ${files.length}개가 업로드되었습니다. (이미지는 미리보기 자동 생성)`)
    } catch (err) {
      toast.error(getErrorMessage(err, '납품 파일 업로드에 실패했습니다.'))
    } finally {
      setUploading(false)
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

  // 원본 다운로드 — 공용 downloadFileForced(캐시 우회 + blob 강제 저장 + 빈 탭 선점 폴백) 사용.
  // 파일명: 응답값(fileName) 우선, 없으면 유틸이 URL 경로 끝에서 추출.
  const handleDownloadOriginal = async (fileUrl: string, fileName?: string) => {
    if (!commission || downloading) return   // 진행 중 더블클릭 방지
    setDownloading(true)
    try {
      await downloadFileForced(fileUrl, fileName)
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

  // 의뢰자: 결제하기 (PENDING_PAYMENT) → 토스 결제창 → successUrl에서 confirm
  const handlePay = async () => {
    if (!commission || paying) return
    setPaying(true)
    try {
      // 성공 시 결제창이 successUrl로 리다이렉트하므로 이 아래로는 보통 오지 않는다.
      await startCommissionPayment(commission.commissionId)
    } catch (err) {
      // 사용자가 결제창을 닫거나 준비 단계 실패 — 청구는 일어나지 않음
      toast.error(getErrorMessage(err, '결제를 시작하지 못했습니다.'))
      setPaying(false)
    }
  }

  const handleCancel = async () => {
    if (!commission || paying) return
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
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-background)' }}>
        <div className="animate-spin rounded-full w-10 h-10 border-2"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  /* ── 미존재 ── */
  if (notFound || !commission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4"
        style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-outline)' }}>inbox</span>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>존재하지 않는 계약입니다.</p>
        <Link to="/mypage" className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>마이페이지로</Link>
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
  const canPay = isClient && commission.status === 'PENDING_PAYMENT'
  // 결제창을 여는 중(paying)에는 취소 비활성 — 취소와 결제 승인이 엇갈리는 것 방지(서버도 상태로 재차단)
  const canCancel = (isClient || isArtist) && !paying
    && (commission.status === 'IN_PROGRESS' || commission.status === 'PENDING_PAYMENT')
  const canReview = isClient && commission.status === 'COMPLETED'
  const dDay = commission.agreedDeadline
    ? Math.ceil((new Date(commission.agreedDeadline).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)', minHeight: '100vh' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">

        {/* 브레드크럼 */}
        <div className="flex items-center gap-1.5 mb-6 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          <Link to="/mypage" className="hover:text-white transition-colors">마이페이지</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span style={{ color: 'var(--color-on-surface)' }}>계약 #{commission.commissionId}</span>
        </div>

        {/* 진행 스텝퍼 */}
        {commission.status === 'CANCELLED' ? (
          <div className="mb-8 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'color-mix(in srgb, var(--color-error) 10%, transparent)', color: 'var(--color-error)' }}>
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
                        ? { background: 'var(--color-primary)', color: '#fff' }
                        : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline)' }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className="text-xs font-bold" style={{ color: done ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)' }}>{label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2" style={{ background: cur > i ? 'var(--color-primary)' : 'var(--color-surface-container-highest)' }} />
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
                  style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                  {TYPE_LABEL[commission.commissionType] ?? commission.commissionType}
                </span>
                {dDay !== null && (
                  <span className="text-xs font-bold"
                    style={{ color: dDay <= 3 ? 'var(--color-error)' : 'var(--color-on-surface-variant)' }}>
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
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))', color: '#fff' }}>
                    {(nickname ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</div>
                    {nickname ? (
                      <Link to={`/profile/${nickname}`}
                        className="font-bold text-sm hover:text-primary transition-colors">
                        @{nickname}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>미정</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 의뢰 내용 — 거래 스냅샷(원글이 수정·삭제돼도 당시 내용 보존) */}
            {commission.description && (
              <div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>의뢰 내용</div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
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
                style={{ background: 'color-mix(in srgb, var(--color-success) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)', color: 'var(--color-success)' }}>
                <span className="material-symbols-outlined text-base">check_circle</span>
                {new Date(commission.completedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 완료
              </div>
            )}

          </div>

          {/* ===== 우측 사이드바 ===== */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="sticky top-20 rounded-2xl border p-5 space-y-4"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>

              {/* 합의 금액 */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>합의 금액</div>
                <div className="text-2xl font-bold">₩{Number(commission.agreedPrice).toLocaleString()}</div>
              </div>

              <div className="h-px" style={{ background: 'var(--color-surface-container-highest)' }} />

              {/* 합의 마감일 */}
              {commission.agreedDeadline && (
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>합의 마감일</span>
                  <span className="font-bold">
                    {new Date(commission.agreedDeadline).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}

              {/* 상태 */}
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--color-on-surface-variant)' }}>상태</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>
                  {STATUS_LABEL[commission.status]}
                </span>
              </div>

              <div className="h-px" style={{ background: 'var(--color-surface-container-highest)' }} />

              {/* 진행 타임라인 — 단계 전이 시각(수락→검토요청→완료/취소). 발생한 단계만 표시 */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>진행 기록</div>
                {([
                  { label: '수락', at: commission.createdAt },
                  { label: '검토 요청', at: commission.reviewRequestedAt },
                  { label: '완료', at: commission.completedAt },
                  { label: '취소', at: commission.cancelledAt },
                ] as const).filter(s => s.at).map(s => (
                  <div key={s.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.label === '취소' ? 'var(--color-error)' : 'var(--color-primary)' }} />
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
                  <div className="h-px" style={{ background: 'var(--color-surface-container-highest)' }} />
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>작업물</div>

                    {/* 워터마크 미리보기 — 다중 캐러셀 + 클릭 확대(라이트박스).
                        원본 업로드 시 자동 생성. 우클릭/드래그 방지(저장 억제 — 베스트 에포트) */}
                    {current && (
                      <div>
                        <div className="relative">
                          <button type="button" onClick={() => setLightboxOpen(true)}
                            className="block w-full cursor-zoom-in" aria-label="미리보기 크게 보기">
                            <img src={current.imageUrl} alt={`미리보기 ${currentIndex + 1}`}
                              className="w-full rounded-lg" style={{ border: '1px solid var(--color-outline)' }}
                              onContextMenu={e => e.preventDefault()} draggable={false} />
                          </button>
                          {/* GIF 원본에서 생성된 미리보기 → 첫 프레임임을 안내 */}
                          {current.sourceFileName?.toLowerCase().endsWith('.gif') && (
                            <div className="absolute top-1 left-2 px-2 py-0.5 rounded-full text-xs font-bold bg-black/60 text-white">
                              GIF 애니메이션 · 미리보기는 첫 프레임
                            </div>
                          )}
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
                                style={{ border: i === currentIndex ? '2px solid var(--color-primary)' : '1px solid var(--color-surface-container-highest)' }}>
                                <img src={p.imageUrl} alt={`미리보기 ${i + 1} 썸네일`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}

                        <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
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
                              style={{ color: 'var(--color-primary)' }}>
                              <span className="material-symbols-outlined text-base">download</span>
                              <span className="truncate">{f.fileName || '원본 다운로드'}</span>
                            </button>
                            {canUploadFile && (
                              <button type="button" onClick={() => handleDeleteFile(f.fileId)} disabled={uploading}
                                aria-label={`${f.fileName} 삭제`}
                                className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container disabled:opacity-50" style={{ color: 'var(--color-error)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : !isArtist && commission.deliveryFileCount > 0 ? (
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                        <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-outline-strong)' }}>lock</span>
                        <span>
                          납품 파일 {commission.deliveryFileCount}개 — 완료 확정 전까지 원본은 잠겨 있습니다.
                          {previews.length === 0 && ' (미리보기 미지원 형식 — 채팅으로 확인해 주세요)'}
                        </span>
                      </div>
                    ) : previews.length === 0 && !canUploadFile ? (
                      <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>작가가 작업물을 전달하면 표시됩니다.</p>
                    ) : null}

                    {/* 작가: 원본 업로드 — 이미지는 워터마크 미리보기 자동 생성("원본 = 미리보기" 재설계) */}
                    {canUploadFile && (
                      <div className="space-y-2 pt-1">
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-surface-container-low disabled:opacity-50"
                          style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                          <span className="material-symbols-outlined text-base">upload_file</span>
                          {uploading ? '업로드 중...' : deliveryFiles.length > 0 ? '납품 파일(원본) 추가' : '납품 파일(원본) 업로드'}
                        </button>
                        <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                          이미지 파일은 업로드 시 워터마크 미리보기가 자동 생성됩니다.
                          (GIF는 첫 프레임 / PSD 등 비이미지는 미리보기 없음)
                        </p>
                        {deliveryFiles.length === 0 && (
                          <p className="text-xs" style={{ color: 'var(--color-accent)' }}>
                            검토 요청하려면 납품 파일을 1개 이상 올려야 합니다.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="h-px" style={{ background: 'var(--color-surface-container-highest)' }} />

              {/* 액션 버튼 */}
              {commission.status !== 'CANCELLED' && commission.status !== 'COMPLETED' && (
                <div className="space-y-2">
                  {canPay && (
                    <>
                      <button onClick={handlePay} disabled={paying}
                        className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'var(--color-primary)', color: '#fff', boxShadow: '0 4px 16px color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
                        {paying ? '결제창 여는 중…' : `결제하기 · ${commission.agreedPrice.toLocaleString()}원`}
                      </button>
                      <p className="text-xs text-center pb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                        결제하면 대금을 플랫폼이 보관하고, 작가가 작업을 시작합니다. 완료 확정 시 작가에게 지급됩니다.
                      </p>
                    </>
                  )}
                  {/* 작가: 의뢰자 결제 대기 안내 */}
                  {isArtist && commission.status === 'PENDING_PAYMENT' && (
                    <p className="text-xs text-center py-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                      의뢰자의 결제를 기다리는 중입니다. 결제 완료 후 작업을 시작할 수 있습니다.
                    </p>
                  )}
                  {canRequestReview && (
                    <button onClick={handleRequestReview} disabled={actionLoading}
                      className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--color-primary)', color: '#fff', boxShadow: '0 4px 16px color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
                      {actionLoading ? '처리 중...' : '검토 요청'}
                    </button>
                  )}
                  {canConfirmComplete && (
                    <button onClick={handleConfirmComplete} disabled={actionLoading}
                      className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--color-success)', color: '#fff', boxShadow: '0 4px 16px color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
                      {actionLoading ? '처리 중...' : '완료 확정'}
                    </button>
                  )}
                  {/* 작가가 검토 요청을 보낸 뒤 의뢰자 확인 대기 안내 */}
                  {isArtist && commission.status === 'REVIEW' && (
                    <p className="text-xs text-center py-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                      의뢰자의 완료 확정을 기다리는 중입니다.
                    </p>
                  )}
                  {canCancel && (
                    <button onClick={handleCancel} disabled={actionLoading}
                      className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-surface-container-low disabled:opacity-50"
                      style={{ border: '1px solid var(--color-outline)', color: 'var(--color-error)' }}>
                      <span className="material-symbols-outlined text-base">cancel</span>
                      {actionLoading ? '처리 중...' : '계약 취소'}
                    </button>
                  )}
                </div>
              )}

              {commission.status === 'COMPLETED' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                    style={{ background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: 'var(--color-success)' }}>
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    거래 완료
                  </div>
                  {canReview && (
                    <button type="button" onClick={() => setReviewOpen(true)}
                      className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                      style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                      <span className="material-symbols-outlined text-base">rate_review</span>
                      {hasReviewed ? '내 리뷰 수정' : '리뷰 남기기'}
                    </button>
                  )}
                </div>
              )}

              {commission.status === 'CANCELLED' && (
                <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'color-mix(in srgb, var(--color-error) 10%, transparent)', color: 'var(--color-error)' }}>
                  <span className="material-symbols-outlined text-base">cancel</span>
                  취소된 계약
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 리뷰 작성/수정 모달 (의뢰자·완료) */}
      {reviewOpen && (
        <CommissionReviewModal
          commissionId={commission.commissionId}
          onClose={() => setReviewOpen(false)}
          onSaved={() => setHasReviewed(true)}
        />
      )}

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
            onContextMenu={e => e.preventDefault()} draggable={false}
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
