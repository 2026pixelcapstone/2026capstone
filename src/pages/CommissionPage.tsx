import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  requestPostApi, type RequestPostSummary, type RequestPostCreateRequest,
  artistServiceApi, type ArtistServiceSummary, type ArtistServiceCreateRequest,
  commissionApi, type CommissionSummary,
} from '../api/commissionApi'
import { galleryApi } from '../api/galleryApi'
import CommissionList from '../components/CommissionList'
import DateField from '../components/DateField'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'
import { useEmailGate } from '../hooks/useEmailGate'
import { useActiveCommissions, ACTIVE_STATUS_LABEL } from '../hooks/useActiveCommissions'

// 커미션 페이지 상단 탭
type CommissionTab = 'artists' | 'requests' | 'mine'

// 서비스 카테고리 — 등록 폼 선택지 (백엔드 저장값과 정확히 일치해야 함)
const SERVICE_CATEGORIES = ['캐릭터', '배경/환경', '애니메이션', '게임 에셋', '초상화', '기타']
// 작가 탭 필터 칩 (전체 + 카테고리)
const CATEGORY_FILTERS = ['전체', ...SERVICE_CATEGORIES]

// 탭별 정렬 옵션 [label, sort파라미터]
const ARTIST_SORTS: [string, string][] = [
  ['최신순', 'createdAt,desc'],
  ['오래된순', 'createdAt,asc'],
]
const REQUEST_SORTS: [string, string][] = [
  ['최신순', 'createdAt,desc'],
  ['마감 임박순', 'deadline,asc'],
  ['높은 예산순', 'budgetMax,desc'],
]

// 아바타 색상 팔레트 (서비스 ID 기반으로 일관된 색상 선택)
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#1a1a3a,var(--color-primary))',
  'linear-gradient(135deg,#1a0a2e,#8b2de0)',
  'linear-gradient(135deg,#0a1628,var(--color-accent))',
  'linear-gradient(135deg,#2c1810,#6b3020)',
  'linear-gradient(135deg,#0a2a1a,#3abf6b)',
  'linear-gradient(135deg,#0a0a1a,#3a3a6b)',
]

function getAvatarGradient(id: number) {
  return AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length]
}

// 작가 카드 — 표시 전용. 포트폴리오 썸네일은 부모가 배치 조회해 props로 전달 (카드별 N+1 제거)
function ArtistCard({ service, portfolio, portfolioLoaded }: {
  service: ArtistServiceSummary
  portfolio: string[]
  portfolioLoaded: boolean
}) {
  const isOpen = service.status === 'OPEN'
  const gradient = getAvatarGradient(service.serviceId)

  return (
    <div className="rounded-2xl overflow-hidden border transition-all hover:shadow-xl hover:-translate-y-0.5"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>

      {/* 포트폴리오 이미지 영역 */}
      <div className="relative h-36 overflow-hidden">
        {portfolioLoaded && portfolio.length > 0 ? (
          <div className="grid h-full"
            style={{ gridTemplateColumns: `repeat(${Math.min(portfolio.length, 3)}, 1fr)`, gap: '2px' }}>
            {portfolio.map((url, i) => (
              <img key={i} src={url} alt=""
                className="w-full h-full object-cover"
                style={{ imageRendering: 'pixelated' }} />
            ))}
          </div>
        ) : (
          <div className="w-full h-full" style={{ background: gradient }} />
        )}
        {/* 하단 페이드 */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 40%, color-mix(in srgb, var(--color-surface) 90%, transparent))' }} />
        {/* 상태 배지 */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold border"
            style={isOpen
              ? { background: 'color-mix(in srgb, var(--color-success) 20%, transparent)', color: 'var(--color-success)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)' }
              : { background: 'rgba(0,0,0,0.5)', color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline)' }}>
            {isOpen ? '모집 중' : '마감'}
          </span>
        </div>
        {/* 아바타 */}
        <div className="absolute bottom-0 left-5 translate-y-1/2 z-10">
          {service.artistProfileImageUrl ? (
            <img src={service.artistProfileImageUrl} alt={service.artistNickname ?? ''}
              className="w-12 h-12 rounded-xl object-cover border-2"
              style={{ borderColor: 'var(--color-surface)' }} />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold border-2"
              style={{ background: gradient, color: '#fff', borderColor: 'var(--color-surface)' }}>
              {(service.artistNickname?.trim()?.[0] ?? '?').toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="p-5 pt-9">
        {/* 작가명 + 서비스 유형 */}
        <div className="mb-2">
          <span className="font-bold">{service.artistNickname?.trim() || '알 수 없음'}</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline)' }}>
            {service.serviceType === 'OPTION' ? '가격 고정형' : '가격 협의형'}
          </span>
        </div>

        {/* 서비스 제목 */}
        <h3 className="text-sm font-bold mb-4 line-clamp-2" style={{ color: 'var(--color-on-surface)' }}>{service.title}</h3>

        {/* 가격 + 기간 + 버튼 */}
        <div className="flex items-end justify-between pt-4 border-t" style={{ borderColor: 'var(--color-outline)' }}>
          <div>
            <span className="text-xs block mb-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              {service.estimatedDays ? `예상 ${service.estimatedDays}일` : '기간 협의'}
            </span>
            <p className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>{formatServicePriceLabel(service)}</p>
          </div>
          <Link to={`/artist-services/${service.serviceId}`}
            className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
            style={{ background: 'var(--color-primary)', color: '#fff' }}>
            서비스 보기
          </Link>
        </div>
      </div>
    </div>
  )
}

function formatServicePriceLabel(service: ArtistServiceSummary) {
  if (service.serviceType === 'OPTION' && service.basePrice != null) {
    return `₩${service.basePrice.toLocaleString()} ~`
  }
  if (service.serviceType === 'QUOTE') {
    if (service.priceMin != null && service.priceMax != null)
      return `₩${service.priceMin.toLocaleString()} ~ ₩${service.priceMax.toLocaleString()}`
    if (service.priceMin != null) return `₩${service.priceMin.toLocaleString()} ~`
    if (service.priceMax != null) return `~ ₩${service.priceMax.toLocaleString()}`
  }
  return '가격 협의'
}

const EMPTY_FORM: RequestPostCreateRequest = {
  title: '',
  description: '',
  budgetMin: undefined,
  budgetMax: undefined,
  deadline: '',
}

const EMPTY_SERVICE_FORM: ArtistServiceCreateRequest = {
  title: '',
  description: '',
  serviceType: 'OPTION',
  basePrice: undefined,
  priceMin: undefined,
  priceMax: undefined,
  estimatedDays: undefined,
  category: '캐릭터',
}

function formatBudget(min?: number | null, max?: number | null) {
  if (!min && !max) return '협의'
  if (min && max) return `₩${min.toLocaleString()} ~ ₩${max.toLocaleString()}`
  if (min) return `₩${min.toLocaleString()} ~`
  return `~ ₩${max!.toLocaleString()}`
}

// URL ?tab 값을 실제 탭으로 해석 (mine은 로그인 시에만, 그 외/미지정은 작가 찾기)
function resolveTab(param: string | null, isLoggedIn: boolean): CommissionTab {
  if (param === 'mine') return isLoggedIn ? 'mine' : 'artists'
  if (param === 'requests') return 'requests'
  return 'artists'
}

export default function CommissionPage() {
  const { isLoggedIn } = useAuthStore()
  // ?tab=mine|requests 로 직접 진입 지원 (메인 "내 커미션 전체" 링크 등)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<CommissionTab>(() => resolveTab(searchParams.get('tab'), isLoggedIn))

  // URL ?tab 또는 로그인 상태(hydration으로 false→true)가 바뀌면 탭 재동기화.
  // tab 파라미터가 없으면 사용자가 수동 선택한 탭을 그대로 유지한다.
  useEffect(() => {
    const param = searchParams.get('tab')
    // 파라미터가 아예 없으면(null) 수동 선택 탭 유지, 있으면(빈 문자열 포함) URL 기준으로 해석
    if (param !== null) setTab(resolveTab(param, isLoggedIn))
  }, [searchParams, isLoggedIn])

  // E-2 배너 — 진행 중 거래 상시 노출(어느 탭에서든). 내 커미션 탭 로더와 별개로 훅으로 조회.
  const { active: activeDeals } = useActiveCommissions()

  // 세션 세대 — 로그인 상태가 바뀌면 증가시켜, 진행 중이던 내 커미션 요청을 무효화한다.
  const sessionRef = useRef(0)
  useEffect(() => {
    sessionRef.current++
  }, [isLoggedIn])
  const [activeCategory, setActiveCategory] = useState('전체')
  const [sort, setSort] = useState('createdAt,desc')

  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // 작가 찾기 상태
  const [artists, setArtists] = useState<ArtistServiceSummary[]>([])
  const [artistLoading, setArtistLoading] = useState(false)
  const [artistPage, setArtistPage] = useState(0)
  const [artistHasMore, setArtistHasMore] = useState(true)
  // 작가별 포트폴리오 썸네일 (배치 조회 결과) + 로드 완료 여부
  const [portfolioMap, setPortfolioMap] = useState<Record<number, string[]>>({})
  const [portfolioLoaded, setPortfolioLoaded] = useState(false)

  // 의뢰 찾기 상태
  const [requests, setRequests] = useState<RequestPostSummary[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [reqPage, setReqPage] = useState(0)
  const [reqHasMore, setReqHasMore] = useState(true)

  const { blocked: gateBlocked, guard: gate, gateProps } = useEmailGate()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<RequestPostCreateRequest>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // 서비스 등록 모달
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [serviceForm, setServiceForm] = useState<ArtistServiceCreateRequest>(EMPTY_SERVICE_FORM)
  const [serviceSubmitting, setServiceSubmitting] = useState(false)
  const [serviceError, setServiceError] = useState('')

  // 내 커미션 탭 (로그인 시)
  const [mySubTab, setMySubTab] = useState<'client' | 'artist'>('client')
  const [myCommissions, setMyCommissions] = useState<{ client: CommissionSummary[]; artist: CommissionSummary[] }>({ client: [], artist: [] })
  // 내가 올린 의뢰글 (수락 전이라 아직 계약이 없는 것 포함) — 의뢰한 커미션 탭 상단에 표시
  const [myRequestPosts, setMyRequestPosts] = useState<RequestPostSummary[]>([])
  const [myLoading, setMyLoading] = useState(false)
  const [myLoaded, setMyLoaded] = useState(false)
  const [myError, setMyError] = useState(false)

  // 탭/카테고리/정렬/검색어 변경 시 0페이지부터 서버 재조회 (탐색 탭만)
  useEffect(() => {
    if (tab === 'artists') fetchArtists(0)
    else if (tab === 'requests') fetchRequests(0)
    // 'mine' 탭은 아래 별도 effect에서 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeCategory, sort, searchKeyword])

  // 내 커미션 로드 (재시도 버튼에서도 호출)
  const loadMyCommissions = useCallback(() => {
    if (!isLoggedIn) return   // 로그아웃 상태면 아예 요청하지 않음(로그아웃 렌더에서 재호출돼 새 세대를 캡처하는 것 차단)
    // 로드 시작 시점의 세션 세대를 캡처. 로그아웃/계정 전환으로 세대가 바뀌면
    // 뒤늦게 도착한 이전 사용자의 응답을 상태에 반영하지 않는다(개인정보 노출 방지).
    const gen = sessionRef.current
    setMyLoading(true)
    setMyError(false)
    Promise.allSettled([
      commissionApi.getMyListAsClient({ size: 50 }),
      commissionApi.getMyListAsArtist({ size: 50 }),
      requestPostApi.getMyList({ size: 50 }),
    ])
      .then(([c, a, r]) => {
        if (gen !== sessionRef.current) return   // 무효화된 세션의 응답 폐기
        const cOk = c.status === 'fulfilled'
        const aOk = a.status === 'fulfilled'
        const rOk = r.status === 'fulfilled'
        // 계약 양쪽 모두 실패 → 에러 상태 (빈 목록과 구분). 목록/loaded는 건드리지 않아 재시도 가능
        if (!cOk && !aOk) {
          setMyError(true)
          toast.error('내 커미션을 불러오지 못했습니다.')
          return
        }
        // 부분 실패 → 성공한 쪽만 표시 + 안내
        if (!cOk || !aOk || !rOk) toast.error('일부 항목을 불러오지 못했습니다.')
        setMyCommissions({
          client: cOk ? c.value.data.data.content : [],
          artist: aOk ? a.value.data.data.content : [],
        })
        setMyRequestPosts(rOk ? r.value.data.data.content : [])
        setMyLoaded(true)
      })
      .finally(() => { if (gen === sessionRef.current) setMyLoading(false) })
  }, [isLoggedIn])

  // 내 커미션 탭 — 진입 시 로드. 로딩 중(myLoading)이면 중복 요청 방지,
  // 실패(myError) 시 자동 재요청 루프 방지(재시도는 "다시 시도" 버튼이 담당).
  useEffect(() => {
    if (!isLoggedIn || tab !== 'mine' || myLoaded || myLoading || myError) return
    loadMyCommissions()
  }, [isLoggedIn, tab, myLoaded, myLoading, myError, loadMyCommissions])

  // 탭 전환 시 필터/정렬/검색 초기화
  const handleTabChange = (next: CommissionTab) => {
    if (next === tab) return
    setTab(next)
    setActiveCategory('전체')
    setSort('createdAt,desc')
    setSearchInput('')
    setSearchKeyword('')
  }

  // 로그아웃 시 개인 커미션 데이터 초기화 + '내 커미션' 탭이면 탐색 탭으로 복귀
  // (언마운트 없이 다른 사용자가 로그인해도 이전 사용자 데이터가 남지 않도록)
  useEffect(() => {
    if (isLoggedIn) return
    setMyCommissions({ client: [], artist: [] })
    setMyRequestPosts([])
    setMyLoaded(false)
    setMyError(false)
    setMyLoading(false)
    if (tab === 'mine') handleTabChange('artists')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, tab])

  const fetchArtists = async (page: number) => {
    setArtistLoading(true)
    try {
      const res = await artistServiceApi.getOpenList({
        page, size: 9, sort,
        category: activeCategory !== '전체' ? activeCategory : undefined,
        keyword: searchKeyword || undefined,
      })
      const d = res.data.data
      setArtists(page === 0 ? d.content : prev => [...prev, ...d.content] as ArtistServiceSummary[])
      setArtistPage(page)
      setArtistHasMore(!d.last)

      // 이 페이지 작가들의 포트폴리오를 한 번에 배치 조회 (카드별 N+1 제거)
      const authorIds = [...new Set(d.content.map(s => s.artistId))]
      if (authorIds.length > 0) {
        try {
          const pRes = await galleryApi.getPortfolios(authorIds, 3)
          const map = pRes.data.data
          setPortfolioMap(prev => {
            const next = page === 0 ? {} : { ...prev }
            for (const [id, posts] of Object.entries(map)) {
              next[Number(id)] = posts
                .map(p => p.thumbnailUrl)
                .filter((u): u is string => !!u)
                .slice(0, 3)
            }
            return next
          })
        } catch (e) {
          console.error('[CommissionPage] 포트폴리오 배치 로드 실패:', e)
        }
      } else if (page === 0) {
        setPortfolioMap({})
      }
      setPortfolioLoaded(true)
    } catch {
      toast.error('작가 서비스 목록을 불러오지 못했습니다.')
    } finally {
      setArtistLoading(false)
    }
  }

  const fetchRequests = async (page: number) => {
    setReqLoading(true)
    try {
      const res = await requestPostApi.getOpenList({
        page, size: 9, sort,
        keyword: searchKeyword || undefined,
      })
      const d = res.data.data
      setRequests(page === 0 ? d.content : prev => [...prev, ...d.content] as RequestPostSummary[])
      setReqPage(page)
      setReqHasMore(!d.last)
    } catch {
      toast.error('의뢰 목록을 불러오지 못했습니다.')
    } finally {
      setReqLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchKeyword(searchInput.trim())
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchKeyword('')
    searchRef.current?.focus()
  }

  const handleOpenModal = () => {
    if (!isLoggedIn) {
      alert('로그인이 필요합니다.')
      return
    }
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setFormError('제목을 입력해주세요.'); return }
    setFormError('')
    setSubmitting(true)
    try {
      await requestPostApi.create({
        ...form,
        deadline: form.deadline || undefined,
      })
      setShowModal(false)
      if (tab === 'requests') {
        fetchRequests(0)
      } else {
        handleTabChange('requests')
      }
    } catch (err) {
      setFormError(getErrorMessage(err, '의뢰 등록에 실패했습니다. 다시 시도해주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenServiceModal = () => {
    if (!isLoggedIn) { alert('로그인이 필요합니다.'); return }
    setServiceForm(EMPTY_SERVICE_FORM)
    setServiceError('')
    setShowServiceModal(true)
  }

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!serviceForm.title.trim()) { setServiceError('제목을 입력해주세요.'); return }
    if (serviceForm.serviceType === 'OPTION' && !serviceForm.basePrice) {
      setServiceError('가격 고정형은 기본 가격을 입력해주세요.'); return
    }
    setServiceError('')
    setServiceSubmitting(true)
    try {
      // 유형에 맞지 않는 가격 필드는 비워서 전송
      const payload: ArtistServiceCreateRequest = serviceForm.serviceType === 'OPTION'
        ? { ...serviceForm, priceMin: undefined, priceMax: undefined }
        : { ...serviceForm, basePrice: undefined }
      await artistServiceApi.create(payload)
      setShowServiceModal(false)
      if (tab === 'artists') fetchArtists(0)
      else handleTabChange('artists')
    } catch (err) {
      setServiceError(getErrorMessage(err, '서비스 등록에 실패했습니다. 다시 시도해주세요.'))
    } finally {
      setServiceSubmitting(false)
    }
  }

  // 검색·필터·정렬은 서버에서 처리하므로 목록을 그대로 사용
  const filteredArtists = artists
  const filteredRequests = requests

  return (
    <div style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      {/* 헤더 */}
      <div className="border-b px-8 pt-10 pb-8" style={{ borderColor: 'var(--color-outline)' }}>
        <div className="max-w-[1440px] mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">커미션</h1>
              <p style={{ color: 'var(--color-on-surface-variant)' }}>원하는 픽셀아트를 작가에게 의뢰하거나, 서비스를 등록하세요</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={gate(handleOpenModal)}
                {...gateProps}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${gateBlocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-container'}`}
                style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                {gateBlocked && <span className="material-symbols-outlined text-base">lock</span>}
                의뢰 등록하기
              </button>
              <button
                onClick={gate(handleOpenServiceModal)}
                {...gateProps}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm ${gateBlocked ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                style={{ background: 'var(--color-primary)', color: '#fff' }}>
                {gateBlocked && <span className="material-symbols-outlined text-base">lock</span>}
                서비스 등록하기
              </button>
            </div>
          </div>
          {/* 탭 */}
          <div className="flex gap-1 rounded-xl p-1 w-fit mt-8" style={{ background: 'var(--color-surface-container-low)' }}>
            {([['artists', '작가 찾기'], ['requests', '의뢰 찾기'],
               ...(isLoggedIn ? [['mine', '내 커미션']] : [])] as [string, string][]).map(([key, label]) => (
              <button key={key} onClick={() => handleTabChange(key as typeof tab)}
                className="px-8 py-2.5 rounded-lg font-bold text-sm transition-colors"
                style={tab === key
                  ? { background: 'var(--color-surface-container-high)', color: 'var(--color-primary)' }
                  : { color: 'var(--color-on-surface-variant)' }}>
                {label}
              </button>
            ))}
          </div>

          {/* E-2: 진행 중 거래 배너 — 로그인 + 진행 중 있을 때만, 거래룸 바로가기 */}
          {isLoggedIn && activeDeals.length > 0 && (
            <div className="flex items-center gap-3 mt-6 p-3 rounded-xl flex-wrap"
              style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)' }}>
              <span className="flex items-center gap-1.5 text-sm font-bold shrink-0" style={{ color: 'var(--color-primary)' }}>
                <span className="material-symbols-outlined text-lg">handshake</span>
                진행 중인 거래 {activeDeals.length}건
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {activeDeals.slice(0, 4).map(c => (
                  <Link key={c.commissionId} to={`/commission/${c.commissionId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-surface-container"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                    <span style={{ color: c.status === 'REVIEW' ? 'var(--color-secondary)' : 'var(--color-primary)' }}>
                      {ACTIVE_STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    <span className="line-clamp-1 max-w-40">{c.title ?? '커미션 거래'}</span>
                    {c.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full min-w-4 text-center"
                        style={{ background: 'var(--color-error)', color: 'var(--color-on-primary)' }}>
                        {c.unreadCount}
                      </span>
                    )}
                  </Link>
                ))}
                {activeDeals.length > 4 && (
                  <button type="button" onClick={() => handleTabChange('mine')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-surface-container"
                    style={{ color: 'var(--color-primary)' }}>
                    +{activeDeals.length - 4}건 더
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-8 py-8 pb-16">

        {/* 필터 바 + 검색창 — 탐색 탭에서만 (내 커미션 탭은 개인 목록이라 숨김) */}
        {tab !== 'mine' && (
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          {searchKeyword ? (
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span style={{ color: 'var(--color-on-surface)' }}>"{searchKeyword}"</span> 검색 결과&nbsp;
              {tab === 'artists'
                ? `${filteredArtists.length}개`
                : `${filteredRequests.length}건`}
            </p>
          ) : tab === 'artists' ? (
            /* 작가 탭에서만 카테고리 필터 칩 (의뢰글엔 카테고리 없음) */
            <div className="flex gap-2 flex-wrap">
              {CATEGORY_FILTERS.map(c => (
                <button key={c} onClick={() => setActiveCategory(c)}
                  className="px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
                  style={activeCategory === c
                    ? { background: 'var(--color-primary)', color: '#fff' }
                    : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline)' }}>
                  {c}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}

          <div className="ml-auto flex items-center gap-3">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base"
                  style={{ color: 'var(--color-on-surface-variant)' }}>search</span>
                <input
                  ref={searchRef}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={tab === 'artists' ? '작가 검색...' : '의뢰 검색...'}
                  className="pl-10 pr-8 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)', width: 200 }}
                />
                {(searchInput || searchKeyword) && (
                  <button type="button" onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-white"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            </form>
            {!searchKeyword && (
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="appearance-none px-5 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                {(tab === 'artists' ? ARTIST_SORTS : REQUEST_SORTS).map(([label, value]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        )}

        {/* 작가 찾기 탭 */}
        {tab === 'artists' && (
          artistLoading && artists.length === 0 ? (
            <div className="grid grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border animate-pulse overflow-hidden"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
                  <div style={{ height: 144, background: 'var(--color-surface-container)' }} />
                  <div className="p-5 pt-9 space-y-3">
                    <div className="h-4 rounded" style={{ background: 'var(--color-surface-container)', width: '55%' }} />
                    <div className="h-3 rounded" style={{ background: 'var(--color-surface-container)', width: '80%' }} />
                    <div className="h-3 rounded" style={{ background: 'var(--color-surface-container)', width: '65%' }} />
                    <div className="h-8 rounded mt-4" style={{ background: 'var(--color-surface-container)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredArtists.length === 0 ? (
            <div className="flex items-center justify-center py-24 rounded-2xl border"
              style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)', borderStyle: 'dashed' }}>
              <div className="text-center">
                {searchKeyword ? (
                  <>
                    <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: 'var(--color-outline)' }}>search_off</span>
                    <p className="font-bold mb-1">"{searchKeyword}"에 해당하는 서비스가 없습니다</p>
                    <button onClick={clearSearch}
                      className="mt-4 text-sm font-bold hover:underline"
                      style={{ color: 'var(--color-primary)' }}>
                      전체 서비스 보기
                    </button>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: 'var(--color-outline)' }}>brush</span>
                    <p className="font-bold mb-1">등록된 작가 서비스가 없습니다</p>
                    <p className="text-sm">첫 번째로 서비스를 등록해보세요</p>
                    <button
                      onClick={gate(handleOpenServiceModal)}
                      {...gateProps}
                      className={`mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm ${gateBlocked ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                      style={{ background: 'var(--color-primary)', color: '#fff' }}>
                      {gateBlocked && <span className="material-symbols-outlined text-base">lock</span>}
                      서비스 등록하기
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-6">
                {filteredArtists.map(service => (
                  <ArtistCard key={service.serviceId} service={service}
                    portfolio={portfolioMap[service.artistId] ?? []}
                    portfolioLoaded={portfolioLoaded} />
                ))}
              </div>

              {artistHasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => fetchArtists(artistPage + 1)}
                    disabled={artistLoading}
                    className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:bg-surface-container disabled:opacity-50"
                    style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                    {artistLoading ? '불러오는 중...' : '더 보기'}
                  </button>
                </div>
              )}
            </>
          )
        )}

        {/* 의뢰 찾기 탭 */}
        {tab === 'requests' && (
          <>
            {reqLoading && requests.length === 0 ? (
              <div className="grid grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border animate-pulse"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)', height: 180 }} />
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="flex items-center justify-center py-24 rounded-2xl border"
                style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)', borderStyle: 'dashed' }}>
                <div className="text-center">
                  {searchKeyword ? (
                    <>
                      <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: 'var(--color-outline)' }}>search_off</span>
                      <p className="font-bold mb-1">"{searchKeyword}"에 대한 의뢰가 없습니다</p>
                      <button onClick={clearSearch}
                        className="mt-4 text-sm font-bold hover:underline"
                        style={{ color: 'var(--color-primary)' }}>
                        전체 의뢰 보기
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: 'var(--color-outline)' }}>inbox</span>
                      <p className="font-bold mb-1">등록된 의뢰가 없습니다</p>
                      <p className="text-sm">첫 번째로 의뢰를 등록해보세요</p>
                      <button onClick={handleOpenModal}
                        className="mt-4 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                        style={{ background: 'var(--color-primary)', color: '#fff' }}>
                        의뢰 등록하기
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-6">
                  {filteredRequests.map(req => {
                    const isOpen = req.status === 'OPEN'
                    const dDay = req.deadline
                      ? Math.ceil((new Date(req.deadline).getTime() - Date.now()) / 86400000)
                      : null
                    return (
                      <Link key={req.requestPostId} to={`/request-posts/${req.requestPostId}`}
                        className="rounded-2xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-lg hover:border-primary-hover group"
                        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
                        {/* 상단: 상태 + D-day */}
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
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

                        {/* 제목 */}
                        <h3 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                          {req.title}
                        </h3>

                        {/* 의뢰자 */}
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                          <span className="material-symbols-outlined text-xs">person</span>
                          <span>@{req.clientNickname ?? '알 수 없음'}</span>
                        </div>

                        {/* 예산 + 마감 */}
                        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--color-outline)' }}>
                          <div>
                            <span className="text-xs block" style={{ color: 'var(--color-on-surface-variant)' }}>예산</span>
                            <span className="font-bold text-sm">{formatBudget(req.budgetMin, req.budgetMax)}</span>
                          </div>
                          {req.deadline && (
                            <div className="text-right">
                              <span className="text-xs block" style={{ color: 'var(--color-on-surface-variant)' }}>마감일</span>
                              <span className="text-sm font-bold">
                                {new Date(req.deadline).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {reqHasMore && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={() => fetchRequests(reqPage + 1)}
                      disabled={reqLoading}
                      className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:bg-surface-container disabled:opacity-50"
                      style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                      {reqLoading ? '불러오는 중...' : '더 보기'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 내 커미션 탭 */}
        {tab === 'mine' && (
          <div>
            {/* 의뢰자/작가 서브탭 — 역할을 라벨에 명시 */}
            <div className="flex gap-1.5 mb-4 p-1 rounded-xl w-fit" style={{ background: 'var(--color-surface-container-low)' }}>
              {(['client', 'artist'] as const).map(sub => {
                const active = mySubTab === sub
                const count = sub === 'client' ? myCommissions.client.length : myCommissions.artist.length
                return (
                  <button key={sub} onClick={() => setMySubTab(sub)}
                    className="flex items-center gap-2.5 px-4 py-2 rounded-lg transition-colors"
                    style={{ background: active ? 'var(--color-surface-container-high)' : 'transparent' }}>
                    <span className="material-symbols-outlined text-lg"
                      style={{ color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
                      {sub === 'client' ? 'shopping_bag' : 'brush'}
                    </span>
                    <span className="text-left leading-tight">
                      <span className="block text-sm font-bold" style={{ color: active ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)' }}>
                        {sub === 'client' ? '내가 맡긴' : '내가 맡은'}
                        <span className="ml-1.5" style={{ color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>{count}</span>
                      </span>
                      <span className="block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {sub === 'client' ? '의뢰자' : '작가'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 현재 서브탭이 무엇인지 한 줄 안내 */}
            <div className="flex items-center gap-2 mb-6 px-3.5 py-2.5 rounded-xl text-sm"
              style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
              <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-primary)' }}>info</span>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>
                {mySubTab === 'client'
                  ? '내가 다른 작가에게 맡긴 커미션이에요. 의뢰글과 성사된 계약을 나눠서 보여줍니다.'
                  : '다른 사람이 나에게 맡긴 작업이에요.'}
              </span>
            </div>

            {myError && !myLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>error</span>
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>커미션을 불러오지 못했습니다.</p>
                <button onClick={loadMyCommissions}
                  className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>
                  다시 시도
                </button>
              </div>
            ) : (
              <>
                {/* 의뢰한 커미션 탭: 내가 올린 의뢰글 (수락 전 포함) 먼저 노출 */}
                {mySubTab === 'client' && (
                  <div className="mb-8">
                    <div className="flex items-baseline gap-2 mb-3">
                      <h3 className="font-bold text-sm">내 의뢰글</h3>
                      <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                        게시판에 올린 의뢰{myRequestPosts.length > 0 ? ` · ${myRequestPosts.length}` : ''}
                      </span>
                    </div>
                    {myRequestPosts.length === 0 ? (
                      <p className="text-sm py-6 text-center rounded-xl border"
                        style={{ borderColor: 'var(--color-outline)', borderStyle: 'dashed', color: 'var(--color-on-surface-variant)' }}>
                        아직 올린 의뢰글이 없습니다.
                      </p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {myRequestPosts.map(rp => {
                          const open = rp.status === 'OPEN'
                          return (
                            <Link key={rp.requestPostId} to={`/request-posts/${rp.requestPostId}`}
                              className="rounded-xl border p-4 flex items-center justify-between gap-3 transition-colors hover:border-primary-hover"
                              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate" style={{ color: 'var(--color-on-surface)' }}>{rp.title}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                                  {formatBudget(rp.budgetMin, rp.budgetMax)}
                                  {rp.deadline && ` · ~${new Date(rp.deadline).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border"
                                style={open
                                  ? { background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: 'var(--color-success)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)' }
                                  : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline)' }}>
                                {open ? '모집 중' : '마감'}
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                    <div className="h-px mt-8" style={{ background: 'var(--color-surface-container-highest)' }} />
                    <div className="flex items-baseline gap-2 mt-8 mb-3">
                      <h3 className="font-bold text-sm">성사된 계약</h3>
                      <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>작가가 정해진 거래 · 진행/완료 포함</span>
                    </div>
                  </div>
                )}
                <CommissionList
                  commissions={mySubTab === 'client' ? myCommissions.client : myCommissions.artist}
                  loading={myLoading}
                  perspective={mySubTab}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* 의뢰 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          role="dialog" aria-modal="true" aria-labelledby="request-modal-title"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="w-full max-w-lg rounded-2xl border p-6"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 id="request-modal-title" className="text-lg font-bold">의뢰 등록하기</h2>
              <button onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-surface-container"
                style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="의뢰 제목을 입력하세요"
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>설명</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="원하시는 스타일, 참고 레퍼런스, 용도 등을 적어주세요"
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>최소 예산 (원)</label>
                  <input
                    type="number"
                    value={form.budgetMin ?? ''}
                    onChange={e => setForm(f => ({ ...f, budgetMin: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="예: 30000"
                    min={0}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>최대 예산 (원)</label>
                  <input
                    type="number"
                    value={form.budgetMax ?? ''}
                    onChange={e => setForm(f => ({ ...f, budgetMax: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="예: 100000"
                    min={0}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>마감일</label>
                <DateField
                  value={form.deadline ?? ''}
                  onChange={v => setForm(f => ({ ...f, deadline: v }))}
                  placeholder="마감일 선택 (선택사항)"
                />
              </div>

              {formError && (
                <p className="text-sm" style={{ color: 'var(--color-error)' }}>{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors hover:bg-surface-container"
                  style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                  취소
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>
                  {submitting ? '등록 중...' : '의뢰 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 서비스 등록 모달 */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          role="dialog" aria-modal="true" aria-labelledby="service-modal-title"
          onClick={e => { if (e.target === e.currentTarget) setShowServiceModal(false) }}>
          <div className="w-full max-w-lg rounded-2xl border p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 id="service-modal-title" className="text-lg font-bold">서비스 등록하기</h2>
              <button onClick={() => setShowServiceModal(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-surface-container"
                style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleServiceSubmit} className="space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>제목 *</label>
                <input
                  type="text"
                  value={serviceForm.title}
                  onChange={e => setServiceForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 16x16 캐릭터 스프라이트 제작"
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>카테고리</label>
                <select
                  value={serviceForm.category}
                  onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                  {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>설명</label>
                <textarea
                  value={serviceForm.description}
                  onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="작업 범위, 스타일, 제공 항목, 유의사항 등을 적어주세요"
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
              </div>

              {/* 가격 유형 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>가격 유형</label>
                <div className="flex gap-2">
                  {([['OPTION', '가격 고정형'], ['QUOTE', '가격 협의형']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setServiceForm(f => ({ ...f, serviceType: val }))}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors"
                      style={serviceForm.serviceType === val
                        ? { background: 'var(--color-primary)', color: '#fff' }
                        : { background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 가격 — 유형별 분기 */}
              {serviceForm.serviceType === 'OPTION' ? (
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>기본 가격 (원) *</label>
                  <input
                    type="number"
                    value={serviceForm.basePrice ?? ''}
                    onChange={e => setServiceForm(f => ({ ...f, basePrice: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="예: 30000"
                    min={0}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>최소 가격 (원)</label>
                    <input
                      type="number"
                      value={serviceForm.priceMin ?? ''}
                      onChange={e => setServiceForm(f => ({ ...f, priceMin: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="예: 30000"
                      min={0}
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>최대 가격 (원)</label>
                    <input
                      type="number"
                      value={serviceForm.priceMax ?? ''}
                      onChange={e => setServiceForm(f => ({ ...f, priceMax: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="예: 100000"
                      min={0}
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                    />
                  </div>
                </div>
              )}

              {/* 예상 작업 기간 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>예상 작업 기간 (일)</label>
                <input
                  type="number"
                  value={serviceForm.estimatedDays ?? ''}
                  onChange={e => setServiceForm(f => ({ ...f, estimatedDays: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="예: 7"
                  min={1}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
              </div>

              {serviceError && (
                <p className="text-sm" style={{ color: 'var(--color-error)' }}>{serviceError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowServiceModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors hover:bg-surface-container"
                  style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                  취소
                </button>
                <button type="submit" disabled={serviceSubmitting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>
                  {serviceSubmitting ? '등록 중...' : '서비스 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
