import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { artistServiceApi, commissionApi, type ArtistServiceResponse } from '../api/commissionApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'

function formatPrice(service: ArtistServiceResponse) {
  if (service.serviceType === 'OPTION' && service.basePrice != null)
    return `₩${service.basePrice.toLocaleString()}`
  if (service.serviceType === 'QUOTE') {
    if (service.priceMin != null && service.priceMax != null)
      return `₩${service.priceMin.toLocaleString()} ~ ₩${service.priceMax.toLocaleString()}`
    if (service.priceMin != null) return `₩${service.priceMin.toLocaleString()} ~`
    if (service.priceMax != null) return `~ ₩${service.priceMax.toLocaleString()}`
  }
  return '가격 협의'
}

// 아바타 색상 팔레트
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#1a1a3a,#2f81f7)',
  'linear-gradient(135deg,#1a0a2e,#8b2de0)',
  'linear-gradient(135deg,#0a1628,#f0883e)',
  'linear-gradient(135deg,#2c1810,#6b3020)',
  'linear-gradient(135deg,#0a2a1a,#3abf6b)',
  'linear-gradient(135deg,#0a0a1a,#3a3a6b)',
]
function getAvatarGradient(id: number) {
  return AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length]
}

export default function ArtistServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user: me, isLoggedIn } = useAuthStore()
  const navigate = useNavigate()

  const [service, setService] = useState<ArtistServiceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // 의뢰하기 모달
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderPrice, setOrderPrice] = useState('')
  const [orderDeadline, setOrderDeadline] = useState('')
  const [ordering, setOrdering] = useState(false)
  const [ordered, setOrdered] = useState(false)

  // 서비스 ID 변경 시 주문 관련 상태 초기화
  useEffect(() => {
    setShowOrderModal(false)
    setOrderPrice('')
    setOrderDeadline('')
    setOrdering(false)
    setOrdered(false)
  }, [id])

  useEffect(() => {
    if (!id) return
    const serviceId = Number(id)
    if (isNaN(serviceId)) { setNotFound(true); setLoading(false); return }
    artistServiceApi.getService(serviceId)
      .then(res => setService(res.data.data))
      .catch(err => {
        const status = getErrorStatus(err)
        if (status && status >= 500) navigate('/500', { replace: true })
        else setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleClose = async () => {
    if (!service) return
    if (!confirm('서비스를 마감하시겠습니까?')) return
    setActionLoading(true)
    try {
      await artistServiceApi.close(service.serviceId)
      setService(prev => prev ? { ...prev, status: 'CLOSED' } : prev)
      toast.success('서비스가 마감되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '마감 처리에 실패했습니다.'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleOrder = async () => {
    if (!service) return
    const resolvedPrice = orderPrice
      ? Number(orderPrice)
      : service.basePrice ?? service.priceMin ?? null
    if (resolvedPrice === null || !Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
      toast.error('유효한 금액을 입력해주세요.')
      return
    }
    if (orderDeadline) {
      const today = new Date().toISOString().split('T')[0]
      if (orderDeadline < today) {
        toast.error('마감일은 오늘 이후로 설정해주세요.')
        return
      }
    }
    setOrdering(true)
    try {
      const price = resolvedPrice
      await commissionApi.createCommission({
        commissionType: service.serviceType === 'OPTION' ? 'SERVICE_OPTION' : 'SERVICE_QUOTE',
        artistId: service.artistId,
        serviceId: service.serviceId,
        agreedPrice: price,
        agreedDeadline: orderDeadline || undefined,
      })
      setOrdered(true)
      setShowOrderModal(false)
      toast.success('의뢰가 접수되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '의뢰 접수에 실패했습니다.'))
    } finally {
      setOrdering(false)
    }
  }

  const handleDelete = async () => {
    if (!service) return
    if (!confirm('서비스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    setActionLoading(true)
    try {
      await artistServiceApi.delete(service.serviceId)
      toast.success('서비스가 삭제되었습니다.')
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
  if (notFound || !service) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4"
        style={{ background: '#0d1117', color: '#e6edf3' }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: '#30363d' }}>brush</span>
        <p style={{ color: '#7d8590' }}>존재하지 않는 서비스입니다.</p>
        <Link to="/commission" className="text-sm font-bold" style={{ color: '#2f81f7' }}>
          커미션 목록으로
        </Link>
      </div>
    )
  }

  const isOpen = service.status === 'OPEN'
  const isOwner = me?.userId === service.artistId
  const gradient = getAvatarGradient(service.serviceId)

  return (
    <>
    <div style={{ background: '#0d1117', color: '#e6edf3', minHeight: '100vh' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">

        {/* 브레드크럼 */}
        <div className="flex items-center gap-1.5 mb-6 text-sm" style={{ color: '#7d8590' }}>
          <Link to="/commission" className="hover:text-white transition-colors">커미션</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <Link to="/commission" className="hover:text-white transition-colors">작가 찾기</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span style={{ color: '#e6edf3' }} className="truncate max-w-xs">{service.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ===== 좌측 메인 ===== */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* 작가 프로필 카드 */}
            <div className="rounded-2xl overflow-hidden border" style={{ background: '#161b22', borderColor: '#30363d' }}>
              {/* 배너 */}
              <div className="h-32 flex items-center justify-center" style={{ background: gradient }}>
                {service.artistProfileImageUrl ? (
                  <img src={service.artistProfileImageUrl} alt={service.artistNickname ?? ''}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                    {(service.artistNickname ?? '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="p-5 flex items-center justify-between">
                <div>
                  <Link to={`/profile/${service.artistNickname}`}
                    className="font-bold text-lg hover:text-[#2f81f7] transition-colors">
                    @{service.artistNickname ?? '알 수 없음'}
                  </Link>
                  <div className="text-xs mt-0.5" style={{ color: '#7d8590' }}>
                    {service.serviceType === 'OPTION' ? '가격 고정형' : '가격 협의형'}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold border"
                  style={isOpen
                    ? { background: 'rgba(63,185,80,0.1)', color: '#3fb950', borderColor: 'rgba(63,185,80,0.3)' }
                    : { background: '#21262d', color: '#7d8590', borderColor: '#30363d' }}>
                  {isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>

            {/* 서비스 제목 + 설명 */}
            <div className="rounded-2xl border p-5 space-y-3" style={{ background: '#161b22', borderColor: '#30363d' }}>
              <h1 className="text-xl font-bold">{service.title}</h1>
              {service.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#c9d1d9' }}>
                  {service.description}
                </p>
              ) : (
                <p className="text-sm" style={{ color: '#7d8590' }}>서비스 설명이 없습니다.</p>
              )}
            </div>

            {/* 등록일 */}
            <div className="text-sm" style={{ color: '#7d8590' }}>
              등록일: <b style={{ color: '#e6edf3' }}>
                {new Date(service.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
              </b>
            </div>

          </div>

          {/* ===== 우측 사이드바 ===== */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="sticky top-20 rounded-2xl border p-5 space-y-4"
              style={{ background: '#161b22', borderColor: '#30363d' }}>

              {/* 가격 */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#7d8590' }}>
                  {service.serviceType === 'OPTION' ? '가격' : '가격 범위'}
                </div>
                <div className="text-2xl font-bold">{formatPrice(service)}</div>
                {service.serviceType === 'OPTION' && (
                  <div className="text-xs mt-1" style={{ color: '#7d8590' }}>추가 옵션에 따라 달라질 수 있음</div>
                )}
              </div>

              <div className="h-px" style={{ background: '#30363d' }} />

              {/* 예상 작업일 */}
              {service.estimatedDays && (
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#7d8590' }}>예상 작업일</span>
                  <span className="font-bold">{service.estimatedDays}일</span>
                </div>
              )}

              {/* 서비스 유형 */}
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#7d8590' }}>유형</span>
                <span className="font-bold">
                  {service.serviceType === 'OPTION' ? '가격 고정형' : '가격 협의형'}
                </span>
              </div>

              {/* 상태 */}
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#7d8590' }}>상태</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  style={isOpen
                    ? { background: 'rgba(63,185,80,0.1)', color: '#3fb950', borderColor: 'rgba(63,185,80,0.3)' }
                    : { background: '#21262d', color: '#7d8590', borderColor: '#30363d' }}>
                  {isOpen ? 'Open' : 'Closed'}
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
                      {actionLoading ? '처리 중...' : '서비스 마감하기'}
                    </button>
                  )}
                  <button onClick={handleDelete} disabled={actionLoading}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-[#1c2128] disabled:opacity-50"
                    style={{ border: '1px solid #30363d', color: '#f85149' }}>
                    <span className="material-symbols-outlined text-base">delete</span>
                    {actionLoading ? '처리 중...' : '서비스 삭제'}
                  </button>
                </div>
              ) : isOpen ? (
                ordered ? (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                    style={{ background: 'rgba(63,185,80,0.1)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)' }}>
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    의뢰 접수 완료
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); return }
                      setShowOrderModal(true)
                    }}
                    className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90"
                    style={{ background: '#2f81f7', color: '#fff', boxShadow: '0 4px 16px rgba(47,129,247,0.3)' }}>
                    의뢰하기
                  </button>
                )
              ) : (
                <div className="flex items-center justify-center py-3 rounded-xl text-sm font-bold"
                  style={{ background: '#21262d', color: '#7d8590' }}>
                  마감된 서비스입니다
                </div>
              )}

              <p className="text-xs text-center leading-relaxed" style={{ color: '#7d8590' }}>
                의뢰 전 작가에게 먼저 문의해 주세요.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* 의뢰하기 모달 */}
    {showOrderModal && service && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={e => { if (e.target === e.currentTarget) setShowOrderModal(false) }}>
        <div className="w-full max-w-md rounded-2xl border p-6 space-y-5"
          style={{ background: '#161b22', borderColor: '#30363d' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">의뢰하기</h2>
            <button onClick={() => setShowOrderModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#21262d]"
              style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          {/* 서비스 정보 요약 */}
          <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#0d1117' }}>
            <div className="font-bold truncate">{service.title}</div>
            <div className="mt-1" style={{ color: '#7d8590' }}>
              @{service.artistNickname} · {formatPrice(service)}
            </div>
          </div>

          {/* QUOTE형일 때만 가격 입력 */}
          {service.serviceType === 'QUOTE' && (
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>
                제안 금액 <span style={{ color: '#f85149' }}>*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold"
                  style={{ color: '#7d8590' }}>₩</span>
                <input
                  type="number"
                  placeholder={service.priceMin ? String(service.priceMin) : '0'}
                  value={orderPrice}
                  onChange={e => setOrderPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>
            </div>
          )}

          {/* 희망 마감일 */}
          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>
              희망 마감일 <span className="font-normal">(선택)</span>
            </label>
            <input
              type="date"
              value={orderDeadline}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setOrderDeadline(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowOrderModal(false)}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors hover:bg-[#21262d]"
              style={{ border: '1px solid #30363d', color: '#7d8590' }}>
              취소
            </button>
            <button
              onClick={handleOrder}
              disabled={ordering || (service.serviceType === 'QUOTE' && !orderPrice)}
              className="flex-1 py-3 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
              style={{ background: '#2f81f7', color: '#fff' }}>
              {ordering ? '접수 중...' : '의뢰 접수'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
