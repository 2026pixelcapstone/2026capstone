import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { requestPostApi, type RequestPostResponse } from '../api/commissionApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'

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

  const handleClose = async () => {
    if (!post) return
    if (!confirm('의뢰를 마감하시겠습니까?')) return
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
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0d1117' }}>
        <div className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent"
          style={{ borderColor: '#2f81f7' }} />
      </div>
    )
  }

  /* ── 미존재 ── */
  if (notFound || !post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4"
        style={{ background: '#0d1117', color: '#e6edf3' }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: '#30363d' }}>inbox</span>
        <p style={{ color: '#7d8590' }}>존재하지 않는 의뢰입니다.</p>
        <Link to="/commission" className="text-sm font-bold" style={{ color: '#2f81f7' }}>
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
    <div style={{ background: '#0d1117', color: '#e6edf3', minHeight: '100vh' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">

        {/* 브레드크럼 */}
        <div className="flex items-center gap-1.5 mb-6 text-sm" style={{ color: '#7d8590' }}>
          <Link to="/commission" className="hover:text-white transition-colors">커미션</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <Link to="/commission" className="hover:text-white transition-colors">의뢰 찾기</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span style={{ color: '#e6edf3' }} className="truncate max-w-xs">{post.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ===== 좌측 메인 ===== */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* 상태 + 제목 */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-bold border"
                  style={isOpen
                    ? { background: 'rgba(63,185,80,0.1)', color: '#3fb950', borderColor: 'rgba(63,185,80,0.3)' }
                    : { background: '#21262d', color: '#7d8590', borderColor: '#30363d' }}>
                  {isOpen ? '모집 중' : '마감'}
                </span>
                {dDay !== null && (
                  <span className="text-xs font-bold"
                    style={{ color: dDay <= 3 ? '#f85149' : '#7d8590' }}>
                    {dDay > 0 ? `D-${dDay}` : dDay === 0 ? 'D-Day' : '마감'}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
              {post.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#c9d1d9' }}>
                  {post.description}
                </p>
              ) : (
                <p className="text-sm" style={{ color: '#7d8590' }}>설명이 없습니다.</p>
              )}
            </div>

            {/* 의뢰자 프로필 카드 */}
            <div className="flex items-center gap-4 p-5 rounded-2xl border"
              style={{ background: '#161b22', borderColor: '#30363d' }}>
              {post.clientProfileImageUrl ? (
                <img src={post.clientProfileImageUrl} alt={post.clientNickname ?? ''}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#2f81f7,#6366f1)', color: '#fff' }}>
                  {(post.clientNickname ?? '?')[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-xs mb-0.5" style={{ color: '#7d8590' }}>의뢰자</div>
                <Link to={`/profile/${post.clientNickname}`}
                  className="font-bold hover:text-[#2f81f7] transition-colors">
                  @{post.clientNickname ?? '알 수 없음'}
                </Link>
              </div>
            </div>

            {/* 등록일 / 수정일 */}
            <div className="flex gap-6 text-sm" style={{ color: '#7d8590' }}>
              <span>등록일: <b style={{ color: '#e6edf3' }}>
                {new Date(post.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
              </b></span>
              {post.updatedAt !== post.createdAt && (
                <span>수정일: <b style={{ color: '#e6edf3' }}>
                  {new Date(post.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </b></span>
              )}
            </div>

          </div>

          {/* ===== 우측 사이드바 ===== */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="sticky top-20 rounded-2xl border p-5 space-y-4"
              style={{ background: '#161b22', borderColor: '#30363d' }}>

              {/* 예산 */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#7d8590' }}>예산</div>
                <div className="text-2xl font-bold">{formatBudget(post.budgetMin, post.budgetMax)}</div>
              </div>

              <div className="h-px" style={{ background: '#30363d' }} />

              {/* 마감일 */}
              {post.deadline && (
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#7d8590' }}>마감일</span>
                  <span className="font-bold">
                    {new Date(post.deadline).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}

              {/* 상태 */}
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#7d8590' }}>상태</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  style={isOpen
                    ? { background: 'rgba(63,185,80,0.1)', color: '#3fb950', borderColor: 'rgba(63,185,80,0.3)' }
                    : { background: '#21262d', color: '#7d8590', borderColor: '#30363d' }}>
                  {isOpen ? '모집 중' : '마감'}
                </span>
              </div>

              <div className="h-px" style={{ background: '#30363d' }} />

              {/* 액션 버튼 */}
              {isOwner ? (
                <div className="space-y-2">
                  {isOpen && (
                    <button onClick={handleClose} disabled={actionLoading}
                      className="w-full py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#2f81f7', color: '#fff' }}>
                      {actionLoading ? '처리 중...' : '의뢰 마감하기'}
                    </button>
                  )}
                  <button onClick={handleDelete} disabled={actionLoading}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-[#1c2128] disabled:opacity-50"
                    style={{ border: '1px solid #30363d', color: '#f85149' }}>
                    <span className="material-symbols-outlined text-base">delete</span>
                    {actionLoading ? '처리 중...' : '의뢰 삭제'}
                  </button>
                </div>
              ) : isOpen ? (
                <button
                  onClick={() => { if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); return } }}
                  className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90"
                  style={{ background: '#2f81f7', color: '#fff', boxShadow: '0 4px 16px rgba(47,129,247,0.3)' }}>
                  지원하기
                </button>
              ) : (
                <div className="flex items-center justify-center py-3 rounded-xl text-sm font-bold"
                  style={{ background: '#21262d', color: '#7d8590' }}>
                  마감된 의뢰입니다
                </div>
              )}

              <p className="text-xs text-center leading-relaxed" style={{ color: '#7d8590' }}>
                지원 전 의뢰 내용을 충분히 확인해 주세요.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
