import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { commissionApi, type CommissionResponse } from '../api/commissionApi'
import { fileApi } from '../api/fileApi'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (!commission.fileUrl) { toast.error('납품 파일을 먼저 업로드해주세요.'); return }
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

  // 작가: 납품 파일 업로드 (R2 → 커미션 파일 등록)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !commission) return
    setUploading(true)
    let uploadedUrl: string | null = null
    try {
      uploadedUrl = await fileApi.uploadImage(file, `commissions/${commission.commissionId}/files`)
      const res = await commissionApi.uploadFile(commission.commissionId, {
        fileType: 'FINAL',
        fileUrl: uploadedUrl,
        fileName: file.name,
        fileSize: file.size,
      })
      setCommission(res.data.data)
      toast.success('납품 파일이 업로드되었습니다.')
    } catch (err) {
      // R2 업로드는 됐으나 메타 등록 실패 시 고아 파일 정리
      if (uploadedUrl) await fileApi.deleteFiles([uploadedUrl]).catch(() => {})
      toast.error(getErrorMessage(err, '파일 업로드에 실패했습니다.'))
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
  const canUploadFile = isArtist && (commission.status === 'IN_PROGRESS' || commission.status === 'REVIEW')
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

            {/* 채팅 (준비 중 — Phase 3에서 실시간 채팅 연동) */}
            <div className="rounded-2xl border flex flex-col" style={{ background: '#161b22', borderColor: '#30363d', minHeight: 360 }}>
              <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: '#30363d' }}>
                <span className="material-symbols-outlined text-base" style={{ color: '#2f81f7' }}>chat</span>
                <span className="font-bold text-sm">채팅</span>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-5 text-center">
                <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>forum</span>
                <p className="text-sm font-bold" style={{ color: '#7d8590' }}>실시간 채팅 준비 중</p>
                <p className="text-xs" style={{ color: '#484f58' }}>
                  작가와 의뢰자가 이 계약에 대해 대화할 수 있는 공간입니다. 곧 제공될 예정입니다.
                </p>
              </div>
            </div>

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

              {/* 납품 파일 (진행 중에는 안내 카드 유지, 작가만 업로드) */}
              {(commission.fileUrl || commission.status === 'IN_PROGRESS' || commission.status === 'REVIEW') && (
                <>
                  <div className="h-px" style={{ background: '#30363d' }} />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7d8590' }}>납품 파일</div>
                    {commission.fileUrl ? (
                      <a href={commission.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-bold hover:underline mb-2"
                        style={{ color: '#2f81f7' }}>
                        <span className="material-symbols-outlined text-base">download</span>
                        파일 다운로드
                      </a>
                    ) : (
                      <p className="text-xs mb-2" style={{ color: '#7d8590' }}>
                        {canUploadFile ? '아직 업로드된 파일이 없습니다.' : '작가가 작업물을 전달하면 표시됩니다.'}
                      </p>
                    )}
                    {canUploadFile && (
                      <>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[#1c2128] disabled:opacity-50"
                          style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
                          <span className="material-symbols-outlined text-base">upload_file</span>
                          {uploading ? '업로드 중...' : commission.fileUrl ? '파일 교체' : '납품 파일 업로드'}
                        </button>
                      </>
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
    </div>
  )
}
