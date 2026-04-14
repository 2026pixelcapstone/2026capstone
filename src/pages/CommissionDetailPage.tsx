import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { commissionApi, type CommissionResponse, type CommissionStatus } from '../api/commissionApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'

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

const NEXT_STATUS: Partial<Record<CommissionStatus, CommissionStatus>> = {
  IN_PROGRESS: 'REVIEW',
  REVIEW:      'COMPLETED',
}
const NEXT_STATUS_LABEL: Partial<Record<CommissionStatus, string>> = {
  IN_PROGRESS: '검토 요청',
  REVIEW:      '완료 처리',
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

  const handleNextStatus = async () => {
    if (!commission) return
    const next = NEXT_STATUS[commission.status]
    if (!next) return
    setActionLoading(true)
    try {
      const res = await commissionApi.updateStatus(commission.commissionId, next)
      setCommission(res.data.data)
      toast.success('상태가 업데이트되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '상태 변경에 실패했습니다.'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!commission) return
    if (!confirm('계약을 취소하시겠습니까?')) return
    setActionLoading(true)
    try {
      await commissionApi.cancel(commission.commissionId)
      setCommission(prev => prev ? { ...prev, status: 'CANCELLED' } : prev)
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
  const nextLabel = NEXT_STATUS_LABEL[commission.status]
  const canNextStatus = isArtist && !!nextLabel
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
              <h1 className="text-2xl font-bold">계약 #{commission.commissionId}</h1>
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

            {/* 납품 파일 */}
            {commission.fileUrl && (
              <div className="rounded-2xl border p-5" style={{ background: '#161b22', borderColor: '#30363d' }}>
                <h2 className="font-bold mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base" style={{ color: '#2f81f7' }}>folder_zip</span>
                  납품 파일
                </h2>
                <a href={commission.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-bold hover:underline"
                  style={{ color: '#2f81f7' }}>
                  <span className="material-symbols-outlined text-base">download</span>
                  파일 다운로드
                </a>
              </div>
            )}

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

              {/* 계약 시작일 */}
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#7d8590' }}>계약일</span>
                <span className="font-bold">
                  {new Date(commission.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </span>
              </div>

              <div className="h-px" style={{ background: '#30363d' }} />

              {/* 액션 버튼 */}
              {commission.status !== 'CANCELLED' && commission.status !== 'COMPLETED' && (
                <div className="space-y-2">
                  {canNextStatus && (
                    <button onClick={handleNextStatus} disabled={actionLoading}
                      className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#2f81f7', color: '#fff', boxShadow: '0 4px 16px rgba(47,129,247,0.3)' }}>
                      {actionLoading ? '처리 중...' : nextLabel}
                    </button>
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
    </div>
  )
}
