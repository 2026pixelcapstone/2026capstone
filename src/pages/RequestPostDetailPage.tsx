import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { requestPostApi, applicationApi, type RequestPostResponse, type ApplicationResponse } from '../api/commissionApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'
import { useFocusTrap } from '../hooks/useFocusTrap'
import DateField from '../components/DateField'

function formatBudget(min?: number | null, max?: number | null) {
  if (!min && !max) return '협의'
  if (min && max) return `₩${min.toLocaleString()} ~ ₩${max.toLocaleString()}`
  if (min) return `₩${min.toLocaleString()} ~`
  return `~ ₩${max!.toLocaleString()}`
}

export default function RequestPostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user: me, isLoggedIn } = useAuthStore()
  const navigate = useNavigate()

  const [post, setPost] = useState<RequestPostResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // 지원하기 모달
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyMessage, setApplyMessage] = useState('')
  const [applyPrice, setApplyPrice] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  // 수정 모달 (작성자)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editBudgetMin, setEditBudgetMin] = useState('')
  const [editBudgetMax, setEditBudgetMax] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editing, setEditing] = useState(false)

  // 모달 접근성 — 포커스 트랩(Tab 가둠·ESC 닫기·포커스 복원)
  const applyModalRef = useRef<HTMLDivElement>(null)
  const editModalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(showApplyModal, applyModalRef, () => setShowApplyModal(false))
  useFocusTrap(showEditModal, editModalRef, () => setShowEditModal(false))

  // 의뢰자용 지원자 목록
  const [applications, setApplications] = useState<ApplicationResponse[]>([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [accepting, setAccepting] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    const postId = Number(id)
    if (isNaN(postId)) { setNotFound(true); setLoading(false); return }
    requestPostApi.getPost(postId)
      .then(res => setPost(res.data.data))
      .catch(err => {
        const status = getErrorStatus(err)
        if (status && status >= 500) navigate('/500', { replace: true })
        else setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id])

  // 이미 지원한 게시물인지 마운트 시 확인 (내 지원 목록에서 현재 postId 검색)
  useEffect(() => {
    if (!id || !isLoggedIn) return
    const postId = Number(id)
    if (isNaN(postId)) return
    applicationApi.getMyApplications({ page: 0, size: 50 })
      .then(res => {
        const alreadyApplied = res.data.data.content.some(
          (app: ApplicationResponse) => app.requestPostId === postId
        )
        if (alreadyApplied) setApplied(true)
      })
      .catch(() => { /* 조회 실패 시 버튼 기본 표시 */ })
  }, [id, isLoggedIn])

  // 의뢰자 본인이면 지원자 목록 조회
  useEffect(() => {
    if (!post || me?.userId !== post.clientId) return
    setAppsLoading(true)
    applicationApi.getByPost(post.requestPostId, { size: 50 })
      .then(res => setApplications(res.data.data.content))
      .catch(() => toast.error('지원자 목록을 불러오지 못했습니다.'))
      .finally(() => setAppsLoading(false))
  }, [post, me?.userId])

  const handleClose = async () => {
    if (!post) return
    if (!confirm('의뢰를 마감하시겠습니까?\n남은 대기 중 지원자는 거절되며, 이미 수락한 계약은 그대로 진행됩니다.')) return
    setActionLoading(true)
    try {
      await requestPostApi.close(post.requestPostId)
      setPost(prev => prev ? { ...prev, status: 'CLOSED' } : prev)
      toast.success('의뢰가 마감되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '마감 처리에 실패했습니다.'))
    } finally {
      setActionLoading(false)
    }
  }

  const openEdit = () => {
    if (!post) return
    setEditTitle(post.title)
    setEditDesc(post.description ?? '')
    setEditBudgetMin(post.budgetMin != null ? String(post.budgetMin) : '')
    setEditBudgetMax(post.budgetMax != null ? String(post.budgetMax) : '')
    setEditDeadline(post.deadline ?? '')
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!post) return
    if (!editTitle.trim()) { toast.error('제목을 입력해 주세요.'); return }
    const min = editBudgetMin ? Number(editBudgetMin) : undefined
    const max = editBudgetMax ? Number(editBudgetMax) : undefined
    if (min != null && max != null && min > max) {
      toast.error('최소 예산은 최대 예산보다 클 수 없습니다.'); return
    }
    setEditing(true)
    try {
      const res = await requestPostApi.update(post.requestPostId, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        budgetMin: min,
        budgetMax: max,
        deadline: editDeadline || undefined,
      })
      setPost(res.data.data)
      setShowEditModal(false)
      toast.success('의뢰가 수정되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '수정에 실패했습니다.'))
    } finally {
      setEditing(false)
    }
  }

  const handleApply = async () => {
    if (!post) return
    const price = Number(applyPrice)
    if (!applyPrice || !Number.isFinite(price) || price < 1) {
      toast.error('제안 금액을 입력해 주세요.'); return
    }
    if (post.budgetMin != null && price < post.budgetMin) {
      toast.error(`제안 금액은 최소 예산(₩${post.budgetMin.toLocaleString()}) 이상이어야 합니다.`); return
    }
    setApplying(true)
    try {
      await applicationApi.apply({
        requestPostId: post.requestPostId,
        message: applyMessage || undefined,
        proposedPrice: price,
      })
      setApplied(true)
      setShowApplyModal(false)
      toast.success('지원이 완료되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '지원에 실패했습니다.'))
    } finally {
      setApplying(false)
    }
  }

  // 의뢰자: 지원 수락 → 계약 생성 (복수 수락 가능, 의뢰글은 직접 마감 전까지 유지)
  const handleAccept = async (applicationId: number) => {
    if (!post) return
    if (!confirm('이 작가의 지원을 수락하시겠습니까?\n수락하면 이 작가와 계약이 생성됩니다. 여러 작가를 수락할 수 있고, 모집을 끝내려면 "의뢰 마감"을 눌러주세요.')) return
    setAccepting(applicationId)
    try {
      await applicationApi.accept(applicationId)
      // 수락 상태 + 생성된 커미션(commissionId) 반영을 위해 목록 갱신
      const listRes = await applicationApi.getByPost(post.requestPostId, { size: 50 })
      setApplications(listRes.data.data.content)
      toast.success('지원을 수락했습니다. 계약이 생성되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '수락에 실패했습니다.'))
    } finally {
      setAccepting(null)
    }
  }

  const handleDelete = async () => {
    if (!post) return
    if (!confirm('의뢰를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    setActionLoading(true)
    try {
      await requestPostApi.delete(post.requestPostId)
      toast.success('의뢰가 삭제되었습니다.')
      navigate('/commission', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, '삭제에 실패했습니다.'))
      setActionLoading(false)
    }
  }

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-background)' }}>
        <div className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  /* ── 미존재 ── */
  if (notFound || !post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4"
        style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-outline)' }}>inbox</span>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>존재하지 않는 의뢰입니다.</p>
        <Link to="/commission" className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
          커미션 목록으로
        </Link>
      </div>
    )
  }

  const isOpen = post.status === 'OPEN'
  const isOwner = me?.userId === post.clientId
  const dDay = post.deadline
    ? Math.ceil((new Date(post.deadline).getTime() - Date.now()) / 86400000)
    : null

  return (
    <>
    <div style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)', minHeight: '100vh' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">

        {/* 브레드크럼 */}
        <div className="flex items-center gap-1.5 mb-6 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          <Link to="/commission" className="hover:text-white transition-colors">커미션</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <Link to="/commission" className="hover:text-white transition-colors">의뢰 찾기</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span style={{ color: 'var(--color-on-surface)' }} className="truncate max-w-xs">{post.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ===== 좌측 메인 ===== */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* 상태 + 제목 */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-bold border"
                  style={isOpen
                    ? { background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: 'var(--color-success)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)' }
                    : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline)' }}>
                  {isOpen ? '모집 중' : '마감'}
                </span>
                {dDay !== null && (
                  <span className="text-xs font-bold"
                    style={{ color: dDay <= 3 ? 'var(--color-error)' : 'var(--color-on-surface-variant)' }}>
                    {dDay > 0 ? `D-${dDay}` : dDay === 0 ? 'D-Day' : '마감'}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
              {post.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>
                  {post.description}
                </p>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>설명이 없습니다.</p>
              )}
            </div>

            {/* 의뢰자 프로필 카드 */}
            <div className="flex items-center gap-4 p-5 rounded-2xl border"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
              {post.clientProfileImageUrl ? (
                <img src={post.clientProfileImageUrl} alt={post.clientNickname ?? ''}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))', color: '#fff' }}>
                  {(post.clientNickname?.trim()?.[0] ?? '?').toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-xs mb-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>의뢰자</div>
                <Link to={`/profile/${post.clientNickname}`}
                  className="font-bold hover:text-primary transition-colors">
                  @{post.clientNickname ?? '알 수 없음'}
                </Link>
              </div>
            </div>

            {/* 등록일 / 수정일 */}
            <div className="flex gap-6 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span>등록일: <b style={{ color: 'var(--color-on-surface)' }}>
                {new Date(post.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
              </b></span>
              {post.updatedAt !== post.createdAt && (
                <span>수정일: <b style={{ color: 'var(--color-on-surface)' }}>
                  {new Date(post.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </b></span>
              )}
            </div>

            {/* ===== 지원자 목록 (의뢰자 본인만) ===== */}
            {isOwner && (
              <div>
                <h2 className="font-bold text-lg mb-3">지원자 {applications.length > 0 && `(${applications.length})`}</h2>
                {appsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
                    ))}
                  </div>
                ) : applications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-2xl border"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-outline)' }}>group</span>
                    <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>아직 지원자가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map(app => {
                      // 지원 상태 배지 — ACCEPTED는 연결된 커미션 상태를 우선 반영
                      const st = (() => {
                        if (app.status === 'PENDING')  return { label: '대기 중', color: 'var(--color-accent)', bg: 'rgba(240,136,62,0.1)' }
                        if (app.status === 'REJECTED') return { label: '거절됨',  color: 'var(--color-on-surface-variant)', bg: 'rgba(125,133,144,0.1)' }
                        switch (app.commissionStatus) {
                          case 'CANCELLED': return { label: '계약 취소됨', color: 'var(--color-error)', bg: 'color-mix(in srgb, var(--color-error) 10%, transparent)' }
                          case 'COMPLETED': return { label: '거래 완료',   color: 'var(--color-primary)', bg: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }
                          case 'REVIEW':    return { label: '검토 중',     color: '#a371f7', bg: 'rgba(163,113,247,0.1)' }
                          default:          return { label: '수락됨',      color: 'var(--color-success)', bg: 'color-mix(in srgb, var(--color-success) 10%, transparent)' }
                        }
                      })()
                      const isCancelled = app.status === 'ACCEPTED' && app.commissionStatus === 'CANCELLED'
                      return (
                        <div key={app.applicationId} className="rounded-2xl border p-4"
                          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-3 min-w-0">
                              {app.artistProfileImageUrl ? (
                                <img src={app.artistProfileImageUrl} alt={app.artistNickname ?? ''}
                                  className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                                  style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))', color: '#fff' }}>
                                  {(app.artistNickname?.trim()?.[0] ?? '?').toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <Link to={`/profile/${app.artistNickname}`}
                                  className="font-bold text-sm hover:text-primary transition-colors">
                                  @{app.artistNickname ?? '알 수 없음'}
                                </Link>
                                <div className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                                  {app.proposedPrice != null ? `제안가 ₩${app.proposedPrice.toLocaleString()}` : '제안가 미입력'}
                                  {' · '}{new Date(app.createdAt).toLocaleDateString('ko-KR')}
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{ background: st.bg, color: st.color }}>{st.label}</span>
                          </div>

                          {app.message && (
                            <p className="text-sm whitespace-pre-wrap mb-3" style={{ color: 'var(--color-on-surface)' }}>{app.message}</p>
                          )}

                          {isOpen && app.status === 'PENDING' && (
                            <button onClick={() => handleAccept(app.applicationId)}
                              disabled={accepting !== null}
                              className="w-full py-2.5 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                              style={{ background: 'var(--color-primary)', color: '#fff' }}>
                              {accepting === app.applicationId ? '수락 처리 중...' : '이 작가 수락하기'}
                            </button>
                          )}
                          {app.status === 'ACCEPTED' && app.commissionId && (
                            <Link to={`/commission/${app.commissionId}`}
                              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl font-bold text-sm transition-colors hover:bg-surface-container-low"
                              style={{ border: '1px solid var(--color-outline)', color: isCancelled ? 'var(--color-on-surface-variant)' : 'var(--color-primary)' }}>
                              <span className="material-symbols-outlined text-base">forum</span>
                              {isCancelled ? '취소된 거래 보기' : '거래룸 보기'}
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ===== 우측 사이드바 ===== */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="sticky top-20 rounded-2xl border p-5 space-y-4"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>

              {/* 예산 */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>예산</div>
                <div className="text-2xl font-bold">{formatBudget(post.budgetMin, post.budgetMax)}</div>
              </div>

              <div className="h-px" style={{ background: 'var(--color-surface-container-highest)' }} />

              {/* 마감일 */}
              {post.deadline && (
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>마감일</span>
                  <span className="font-bold">
                    {new Date(post.deadline).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}

              {/* 상태 */}
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--color-on-surface-variant)' }}>상태</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  style={isOpen
                    ? { background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: 'var(--color-success)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)' }
                    : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline)' }}>
                  {isOpen ? '모집 중' : '마감'}
                </span>
              </div>

              <div className="h-px" style={{ background: 'var(--color-surface-container-highest)' }} />

              {/* 액션 버튼 */}
              {isOwner ? (
                <div className="space-y-2">
                  {isOpen && (
                    <button onClick={handleClose} disabled={actionLoading}
                      className="w-full py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--color-primary)', color: '#fff' }}>
                      {actionLoading ? '처리 중...' : '의뢰 마감하기'}
                    </button>
                  )}
                  {isOpen && (
                    <button onClick={openEdit} disabled={actionLoading}
                      className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-surface-container-low disabled:opacity-50"
                      style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                      <span className="material-symbols-outlined text-base">edit</span>
                      의뢰 수정
                    </button>
                  )}
                  <button onClick={handleDelete} disabled={actionLoading}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-surface-container-low disabled:opacity-50"
                    style={{ border: '1px solid var(--color-outline)', color: 'var(--color-error)' }}>
                    <span className="material-symbols-outlined text-base">delete</span>
                    {actionLoading ? '처리 중...' : '의뢰 삭제'}
                  </button>
                </div>
              ) : isOpen ? (
                applied ? (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                    style={{ background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: 'var(--color-success)', border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    지원 완료
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); return }
                      setShowApplyModal(true)
                    }}
                    className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90"
                    style={{ background: 'var(--color-primary)', color: '#fff', boxShadow: '0 4px 16px color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
                    지원하기
                  </button>
                )
              ) : (
                <div className="flex items-center justify-center py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                  마감된 의뢰입니다
                </div>
              )}

              <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                지원 전 의뢰 내용을 충분히 확인해 주세요.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* 지원하기 모달 */}
    {showApplyModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={e => { if (e.target === e.currentTarget) setShowApplyModal(false) }}
        role="dialog" aria-modal="true" aria-labelledby="request-apply-title">
        <div ref={applyModalRef} className="w-full max-w-md rounded-2xl border p-6 space-y-5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
          <div className="flex items-center justify-between">
            <h2 id="request-apply-title" className="text-lg font-bold">지원하기</h2>
            <button onClick={() => setShowApplyModal(false)} aria-label="닫기"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container"
              style={{ color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              제안 금액 <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold"
                style={{ color: 'var(--color-on-surface-variant)' }}>₩</span>
              <input
                type="number"
                placeholder={post.budgetMin != null ? String(post.budgetMin) : '0'}
                min={post.budgetMin ?? 1}
                value={applyPrice}
                onChange={e => setApplyPrice(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
              />
            </div>
            {post.budgetMin != null && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                최소 예산 ₩{post.budgetMin.toLocaleString()} 이상으로 제안할 수 있습니다.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              메시지 <span className="font-normal">(선택)</span>
            </label>
            <textarea
              rows={4}
              placeholder="의뢰자에게 전달할 메시지를 입력하세요."
              value={applyMessage}
              onChange={e => setApplyMessage(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowApplyModal(false)}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors hover:bg-surface-container"
              style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
              취소
            </button>
            <button onClick={handleApply} disabled={applying}
              className="flex-1 py-3 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: '#fff' }}>
              {applying ? '지원 중...' : '지원하기'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 수정 모달 (작성자) */}
    {showEditModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={() => setShowEditModal(false)} role="dialog" aria-modal="true" aria-labelledby="request-edit-title">
        <div ref={editModalRef} className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 id="request-edit-title" className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>의뢰 수정</h2>
            <button type="button" onClick={() => setShowEditModal(false)} aria-label="닫기"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>제목 *</label>
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>설명</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>최소 예산 (원)</label>
                <input type="number" value={editBudgetMin} onChange={e => setEditBudgetMin(e.target.value)} min={0}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>최대 예산 (원)</label>
                <input type="number" value={editBudgetMax} onChange={e => setEditBudgetMax(e.target.value)} min={0}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>마감일</label>
              <DateField value={editDeadline} onChange={setEditDeadline} placeholder="마감일 선택 (선택사항)" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors hover:bg-surface-container"
                style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>취소</button>
              <button type="button" onClick={handleUpdate} disabled={editing}
                className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: '#fff' }}>{editing ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
