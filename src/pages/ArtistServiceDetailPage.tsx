import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { artistServiceApi, commissionApi, type ArtistServiceResponse } from '../api/commissionApi'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'
import { useFocusTrap } from '../hooks/useFocusTrap'

const SERVICE_CATEGORIES = ['캐릭터', '배경/환경', '애니메이션', '게임 에셋', '초상화', '기타']

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

  // 작가 포트폴리오 (작가의 최신 작품)
  const [portfolio, setPortfolio] = useState<GalleryPostSummary[]>([])
  const [portfolioLoading, setPortfolioLoading] = useState(false)

  // 의뢰하기 모달
  // 수정 모달 (작성자)
  const [showEditModal, setShowEditModal] = useState(false)
  const [eTitle, setETitle] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eType, setEType] = useState<'OPTION' | 'QUOTE'>('OPTION')
  const [eBasePrice, setEBasePrice] = useState('')
  const [ePriceMin, setEPriceMin] = useState('')
  const [ePriceMax, setEPriceMax] = useState('')
  const [eDays, setEDays] = useState('')
  const [eCategory, setECategory] = useState('캐릭터')
  const [editing, setEditing] = useState(false)

  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderPrice, setOrderPrice] = useState('')
  const [orderDeadline, setOrderDeadline] = useState('')
  const [ordering, setOrdering] = useState(false)
  const [ordered, setOrdered] = useState(false)
  const orderRequestId = useRef(0)  // race condition 방지용 요청 토큰

  // 모달 접근성 — 포커스 트랩(Tab 가둠·ESC 닫기·포커스 복원)
  const orderModalRef = useRef<HTMLDivElement>(null)
  const editModalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(showOrderModal, orderModalRef, () => setShowOrderModal(false))
  useFocusTrap(showEditModal, editModalRef, () => setShowEditModal(false))

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

  // 서비스 로드 후 작가 포트폴리오(최신 작품 6개) 단일 조회
  useEffect(() => {
    if (!service) return
    let cancelled = false
    setPortfolioLoading(true)
    galleryApi.getList({ authorId: service.artistId, size: 6, sort: 'createdAt,desc' })
      .then(res => { if (!cancelled) setPortfolio(res.data.data.content) })
      .catch(() => { if (!cancelled) setPortfolio([]) })
      .finally(() => { if (!cancelled) setPortfolioLoading(false) })
    return () => { cancelled = true }
  }, [service?.artistId])

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

  const openEdit = () => {
    if (!service) return
    setETitle(service.title)
    setEDesc(service.description ?? '')
    setEType(service.serviceType)
    setEBasePrice(service.basePrice != null ? String(service.basePrice) : '')
    setEPriceMin(service.priceMin != null ? String(service.priceMin) : '')
    setEPriceMax(service.priceMax != null ? String(service.priceMax) : '')
    setEDays(service.estimatedDays != null ? String(service.estimatedDays) : '')
    setECategory(service.category || '캐릭터')
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!service) return
    if (!eTitle.trim()) { toast.error('제목을 입력해 주세요.'); return }
    const basePrice = eBasePrice ? Number(eBasePrice) : undefined
    const pMin = ePriceMin ? Number(ePriceMin) : undefined
    const pMax = ePriceMax ? Number(ePriceMax) : undefined
    const days = eDays ? Number(eDays) : undefined
    const invalid = (n: number | undefined) => n != null && (!Number.isFinite(n) || n < 0)
    if (eType === 'OPTION' && (basePrice == null || invalid(basePrice))) {
      toast.error('기본 가격은 0 이상의 숫자여야 합니다.'); return
    }
    if (invalid(pMin) || invalid(pMax)) { toast.error('가격은 0 이상의 숫자여야 합니다.'); return }
    if (invalid(days)) { toast.error('예상 작업일은 0 이상의 숫자여야 합니다.'); return }
    if (eType === 'QUOTE' && pMin != null && pMax != null && pMin > pMax) {
      toast.error('최소 가격은 최대 가격보다 클 수 없습니다.'); return
    }
    setEditing(true)
    try {
      const res = await artistServiceApi.update(service.serviceId, {
        title: eTitle.trim(),
        description: eDesc.trim() || undefined,
        serviceType: eType,
        basePrice: eType === 'OPTION' ? basePrice : undefined,
        priceMin: eType === 'QUOTE' ? pMin : undefined,
        priceMax: eType === 'QUOTE' ? pMax : undefined,
        estimatedDays: days,
        category: eCategory,
      })
      setService(res.data.data)
      setShowEditModal(false)
      toast.success('서비스가 수정되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '수정에 실패했습니다.'))
    } finally {
      setEditing(false)
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
      const now = new Date()
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      if (orderDeadline < todayLocal) {
        toast.error('마감일은 오늘 이후로 설정해주세요.')
        return
      }
    }
    setOrdering(true)
    const token = ++orderRequestId.current
    try {
      const price = resolvedPrice
      await commissionApi.createCommission({
        commissionType: service.serviceType === 'OPTION' ? 'SERVICE_OPTION' : 'SERVICE_QUOTE',
        artistId: service.artistId,
        serviceId: service.serviceId,
        agreedPrice: price,
        agreedDeadline: orderDeadline || undefined,
      })
      if (token !== orderRequestId.current) return  // 다른 서비스로 이동한 경우 무시
      setOrdered(true)
      setShowOrderModal(false)
      toast.success('의뢰가 접수되었습니다.')
    } catch (err) {
      if (token !== orderRequestId.current) return
      toast.error(getErrorMessage(err, '의뢰 접수에 실패했습니다.'))
    } finally {
      if (token === orderRequestId.current) setOrdering(false)
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

            {/* 작가 포트폴리오 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-lg">작가 포트폴리오</h2>
                <Link to={`/profile/${service.artistNickname}`}
                  className="text-sm font-bold hover:underline" style={{ color: '#2f81f7' }}>
                  프로필에서 더 보기
                </Link>
              </div>
              {portfolioLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: '#21262d' }} />
                  ))}
                </div>
              ) : portfolio.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-2xl border"
                  style={{ background: '#161b22', borderColor: '#30363d' }}>
                  <span className="material-symbols-outlined text-3xl" style={{ color: '#30363d' }}>palette</span>
                  <p className="text-sm" style={{ color: '#7d8590' }}>아직 등록된 작품이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {portfolio.map(w => (
                    <Link key={w.postId} to={`/gallery/${w.postId}`}
                      className="group aspect-square rounded-xl overflow-hidden relative" style={{ background: '#21262d' }}>
                      {w.thumbnailUrl
                        ? <img src={w.thumbnailUrl} alt={w.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                        : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#161b22,#21262d)' }} />}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                        <p className="text-xs font-bold text-white text-center line-clamp-2">{w.title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
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
                  {isOpen && (
                    <button onClick={openEdit} disabled={actionLoading}
                      className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-[#1c2128] disabled:opacity-50"
                      style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
                      <span className="material-symbols-outlined text-base">edit</span>
                      서비스 수정
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
        onClick={e => { if (e.target === e.currentTarget) setShowOrderModal(false) }}
        role="dialog" aria-modal="true" aria-labelledby="service-order-title">
        <div ref={orderModalRef} className="w-full max-w-md rounded-2xl border p-6 space-y-5"
          style={{ background: '#161b22', borderColor: '#30363d' }}>
          <div className="flex items-center justify-between">
            <h2 id="service-order-title" className="text-lg font-bold">의뢰하기</h2>
            <button onClick={() => setShowOrderModal(false)} aria-label="닫기"
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

    {/* 수정 모달 (작성자) */}
    {showEditModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={() => setShowEditModal(false)} role="dialog" aria-modal="true" aria-labelledby="service-edit-title">
        <div ref={editModalRef} className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
          style={{ background: '#161b22', border: '1px solid #30363d' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 id="service-edit-title" className="text-lg font-bold" style={{ color: '#e6edf3' }}>서비스 수정</h2>
            <button type="button" onClick={() => setShowEditModal(false)} aria-label="닫기"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#21262d]" style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>제목 *</label>
              <input type="text" value={eTitle} onChange={e => setETitle(e.target.value)} maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>설명</label>
              <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} rows={4}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>가격 방식</label>
                <select value={eType} onChange={e => setEType(e.target.value as 'OPTION' | 'QUOTE')}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}>
                  <option value="OPTION">가격 고정형</option>
                  <option value="QUOTE">가격 협의형</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>카테고리</label>
                <select value={eCategory} onChange={e => setECategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}>
                  {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {eType === 'OPTION' ? (
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>기본 가격 (원) *</label>
                <input type="number" value={eBasePrice} onChange={e => setEBasePrice(e.target.value)} min={0}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>최소 가격 (원)</label>
                  <input type="number" value={ePriceMin} onChange={e => setEPriceMin(e.target.value)} min={0}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>최대 가격 (원)</label>
                  <input type="number" value={ePriceMax} onChange={e => setEPriceMax(e.target.value)} min={0}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }} />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>예상 작업일 (일)</label>
              <input type="number" value={eDays} onChange={e => setEDays(e.target.value)} min={0}
                placeholder="비우면 기간 협의"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors hover:bg-[#21262d]"
                style={{ border: '1px solid #30363d', color: '#7d8590' }}>취소</button>
              <button type="button" onClick={handleUpdate} disabled={editing}
                className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                style={{ background: '#2f81f7', color: '#fff' }}>{editing ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
