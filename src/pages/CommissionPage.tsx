import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  requestPostApi, type RequestPostSummary, type RequestPostCreateRequest,
  artistServiceApi, type ArtistServiceSummary, type ArtistServiceCreateRequest,
  commissionApi, type CommissionSummary,
} from '../api/commissionApi'
import { galleryApi } from '../api/galleryApi'
import CommissionList from '../components/CommissionList'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'

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

// 작가 카드 — 포트폴리오 lazy fetch 포함
// NOTE: 카드별 개별 API 호출(N+1)은 현재 MVP 구조상 허용.
//       추후 백엔드에서 포트폴리오 포함 응답 또는 배치 API로 개선 예정.
function ArtistCard({ service }: { service: ArtistServiceSummary }) {
  const [portfolio, setPortfolio] = useState<string[]>([])
  const [totalPortfolio, setTotalPortfolio] = useState(0)
  const [portfolioLoaded, setPortfolioLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    // 인기순 2개 + 최신순 2개 병렬 fetch → 중복 제거 → 최대 3개 표시
    Promise.allSettled([
      galleryApi.getList({ authorId: service.artistId, size: 2, sort: 'likeCount,desc' }),
      galleryApi.getList({ authorId: service.artistId, size: 2, sort: 'createdAt,desc' }),
    ]).then(([popular, recent]) => {
      if (cancelled) return
      // 개별 실패 로깅 (allSettled는 전체 reject 안 함)
      if (popular.status === 'rejected') console.error('[ArtistCard] 인기순 로드 실패:', popular.reason)
      if (recent.status  === 'rejected') console.error('[ArtistCard] 최신순 로드 실패:', recent.reason)

      const popularItems = popular.status === 'fulfilled' ? popular.value.data.data.content : []
      const recentItems  = recent.status  === 'fulfilled' ? recent.value.data.data.content  : []
      const total = popular.status === 'fulfilled'
        ? popular.value.data.data.totalElements
        : recent.status === 'fulfilled' ? recent.value.data.data.totalElements : 0

      // 중복 제거: 인기 먼저, 최신 추가
      const seen = new Set<number>()
      const merged = [...popularItems, ...recentItems].filter(p => {
        if (seen.has(p.postId)) return false
        seen.add(p.postId)
        return true
      })

      // filter 후 slice — thumbnailUrl 없는 항목 제거 후 최대 3개
      const urls = merged.map(p => p.thumbnailUrl).filter((u): u is string => !!u).slice(0, 3)
      setPortfolio(urls)
      setTotalPortfolio(total)
    }).finally(() => { if (!cancelled) setPortfolioLoaded(true) })
    return () => { cancelled = true }
  }, [service.artistId])

  const isOpen = service.status === 'OPEN'
  const gradient = getAvatarGradient(service.serviceId)

  return (
    <div className="rounded-2xl overflow-hidden border transition-all hover:shadow-xl hover:-translate-y-0.5"
      style={{ background: '#161b22', borderColor: '#30363d' }}>

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
          style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(22,27,34,0.9))' }} />
        {/* 상태 배지 */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold border"
            style={isOpen
              ? { background: 'rgba(63,185,80,0.2)', color: '#3fb950', borderColor: 'rgba(63,185,80,0.3)' }
              : { background: 'rgba(0,0,0,0.5)', color: '#7d8590', borderColor: '#30363d' }}>
            {isOpen ? '모집 중' : '마감'}
          </span>
        </div>
        {/* 포트폴리오 카운트 — totalElements 기준으로 실제 총 개수 표시 */}
        {portfolioLoaded && totalPortfolio > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#e6edf3' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>photo_library</span>
            포트폴리오 {totalPortfolio}
          </div>
        )}
        {/* 아바타 */}
        <div className="absolute bottom-0 left-5 translate-y-1/2 z-10">
          {service.artistProfileImageUrl ? (
            <img src={service.artistProfileImageUrl} alt={service.artistNickname ?? ''}
              className="w-12 h-12 rounded-xl object-cover border-2"
              style={{ borderColor: '#161b22' }} />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold border-2"
              style={{ background: gradient, color: '#fff', borderColor: '#161b22' }}>
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
            style={{ background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
            {service.serviceType === 'OPTION' ? '가격 고정형' : '가격 협의형'}
          </span>
        </div>

        {/* 서비스 제목 */}
        <h3 className="text-sm font-bold mb-4 line-clamp-2" style={{ color: '#e6edf3' }}>{service.title}</h3>

        {/* 가격 + 기간 + 버튼 */}
        <div className="flex items-end justify-between pt-4 border-t" style={{ borderColor: '#30363d' }}>
          <div>
            <span className="text-xs block mb-0.5" style={{ color: '#7d8590' }}>
              {service.estimatedDays ? `예상 ${service.estimatedDays}일` : '기간 협의'}
            </span>
            <p className="font-bold text-lg" style={{ color: '#2f81f7' }}>{formatServicePriceLabel(service)}</p>
          </div>
          <Link to={`/artist-services/${service.serviceId}`}
            className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
            style={{ background: '#2f81f7', color: '#fff' }}>
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

export default function CommissionPage() {
  const { isLoggedIn } = useAuthStore()
  const [tab, setTab] = useState<'artists' | 'requests' | 'mine'>('artists')
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

  // 의뢰 찾기 상태
  const [requests, setRequests] = useState<RequestPostSummary[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [reqPage, setReqPage] = useState(0)
  const [reqHasMore, setReqHasMore] = useState(true)

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
  const [myLoading, setMyLoading] = useState(false)
  const [myLoaded, setMyLoaded] = useState(false)

  // 탭/카테고리/정렬/검색어 변경 시 0페이지부터 서버 재조회 (탐색 탭만)
  useEffect(() => {
    if (tab === 'artists') fetchArtists(0)
    else if (tab === 'requests') fetchRequests(0)
    // 'mine' 탭은 아래 별도 effect에서 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeCategory, sort, searchKeyword])

  // 내 커미션 탭 — 최초 진입 시 1회 로드
  useEffect(() => {
    if (tab !== 'mine' || myLoaded) return
    setMyLoading(true)
    Promise.allSettled([
      commissionApi.getMyListAsClient({ size: 50 }),
      commissionApi.getMyListAsArtist({ size: 50 }),
    ])
      .then(([c, a]) => {
        if (c.status === 'rejected' || a.status === 'rejected') {
          toast.error('내 커미션을 불러오지 못했습니다.')
        }
        setMyCommissions({
          client: c.status === 'fulfilled' ? c.value.data.data.content : [],
          artist: a.status === 'fulfilled' ? a.value.data.data.content : [],
        })
        // 한쪽이라도 성공하면 로드 완료로 처리 (재진입 시 불필요한 재요청 방지)
        if (c.status === 'fulfilled' || a.status === 'fulfilled') setMyLoaded(true)
      })
      .finally(() => setMyLoading(false))
  }, [tab, myLoaded])

  // 탭 전환 시 필터/정렬/검색 초기화
  const handleTabChange = (next: 'artists' | 'requests' | 'mine') => {
    if (next === tab) return
    setTab(next)
    setActiveCategory('전체')
    setSort('createdAt,desc')
    setSearchInput('')
    setSearchKeyword('')
  }

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
    } catch {
      setFormError('의뢰 등록에 실패했습니다. 다시 시도해주세요.')
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
    } catch {
      setServiceError('서비스 등록에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setServiceSubmitting(false)
    }
  }

  // 검색·필터·정렬은 서버에서 처리하므로 목록을 그대로 사용
  const filteredArtists = artists
  const filteredRequests = requests

  return (
    <div style={{ background: '#0d1117', color: '#e6edf3' }}>
      {/* 헤더 */}
      <div className="border-b px-8 pt-10 pb-8" style={{ borderColor: '#30363d' }}>
        <div className="max-w-[1440px] mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">커미션</h1>
              <p style={{ color: '#7d8590' }}>원하는 픽셀아트를 작가에게 의뢰하거나, 서비스를 등록하세요</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleOpenModal}
                className="px-5 py-2.5 rounded-xl font-bold text-sm transition-colors hover:bg-[#21262d]"
                style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
                의뢰 등록하기
              </button>
              <button
                onClick={handleOpenServiceModal}
                className="px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                style={{ background: '#2f81f7', color: '#fff' }}>
                서비스 등록하기
              </button>
            </div>
          </div>
          {/* 탭 */}
          <div className="flex gap-1 rounded-xl p-1 w-fit mt-8" style={{ background: '#1c2128' }}>
            {([['artists', '작가 찾기'], ['requests', '의뢰 찾기'],
               ...(isLoggedIn ? [['mine', '내 커미션']] : [])] as [string, string][]).map(([key, label]) => (
              <button key={key} onClick={() => handleTabChange(key as typeof tab)}
                className="px-8 py-2.5 rounded-lg font-bold text-sm transition-colors"
                style={tab === key
                  ? { background: '#292f38', color: '#2f81f7' }
                  : { color: '#7d8590' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-8 py-8 pb-16">

        {/* 필터 바 + 검색창 — 탐색 탭에서만 (내 커미션 탭은 개인 목록이라 숨김) */}
        {tab !== 'mine' && (
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          {searchKeyword ? (
            <p className="text-sm" style={{ color: '#7d8590' }}>
              <span style={{ color: '#e6edf3' }}>"{searchKeyword}"</span> 검색 결과&nbsp;
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
                    ? { background: '#2f81f7', color: '#fff' }
                    : { background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
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
                  style={{ color: '#7d8590' }}>search</span>
                <input
                  ref={searchRef}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={tab === 'artists' ? '작가 검색...' : '의뢰 검색...'}
                  className="pl-10 pr-8 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', width: 200 }}
                />
                {(searchInput || searchKeyword) && (
                  <button type="button" onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-white"
                    style={{ color: '#7d8590' }}>
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
                style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3' }}>
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
                  style={{ background: '#161b22', borderColor: '#30363d' }}>
                  <div style={{ height: 144, background: '#21262d' }} />
                  <div className="p-5 pt-9 space-y-3">
                    <div className="h-4 rounded" style={{ background: '#21262d', width: '55%' }} />
                    <div className="h-3 rounded" style={{ background: '#21262d', width: '80%' }} />
                    <div className="h-3 rounded" style={{ background: '#21262d', width: '65%' }} />
                    <div className="h-8 rounded mt-4" style={{ background: '#21262d' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredArtists.length === 0 ? (
            <div className="flex items-center justify-center py-24 rounded-2xl border"
              style={{ borderColor: '#30363d', color: '#7d8590', borderStyle: 'dashed' }}>
              <div className="text-center">
                {searchKeyword ? (
                  <>
                    <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: '#30363d' }}>search_off</span>
                    <p className="font-bold mb-1">"{searchKeyword}"에 해당하는 서비스가 없습니다</p>
                    <button onClick={clearSearch}
                      className="mt-4 text-sm font-bold hover:underline"
                      style={{ color: '#2f81f7' }}>
                      전체 서비스 보기
                    </button>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: '#30363d' }}>brush</span>
                    <p className="font-bold mb-1">등록된 작가 서비스가 없습니다</p>
                    <p className="text-sm">첫 번째로 서비스를 등록해보세요</p>
                    <button
                      onClick={handleOpenServiceModal}
                      className="mt-4 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                      style={{ background: '#2f81f7', color: '#fff' }}>
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
                  <ArtistCard key={service.serviceId} service={service} />
                ))}
              </div>

              {artistHasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => fetchArtists(artistPage + 1)}
                    disabled={artistLoading}
                    className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:bg-[#21262d] disabled:opacity-50"
                    style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
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
                    style={{ background: '#161b22', borderColor: '#30363d', height: 180 }} />
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="flex items-center justify-center py-24 rounded-2xl border"
                style={{ borderColor: '#30363d', color: '#7d8590', borderStyle: 'dashed' }}>
                <div className="text-center">
                  {searchKeyword ? (
                    <>
                      <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: '#30363d' }}>search_off</span>
                      <p className="font-bold mb-1">"{searchKeyword}"에 대한 의뢰가 없습니다</p>
                      <button onClick={clearSearch}
                        className="mt-4 text-sm font-bold hover:underline"
                        style={{ color: '#2f81f7' }}>
                        전체 의뢰 보기
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: '#30363d' }}>inbox</span>
                      <p className="font-bold mb-1">등록된 의뢰가 없습니다</p>
                      <p className="text-sm">첫 번째로 의뢰를 등록해보세요</p>
                      <button onClick={handleOpenModal}
                        className="mt-4 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                        style={{ background: '#2f81f7', color: '#fff' }}>
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
                        className="rounded-2xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-lg hover:border-[#58a6ff] group"
                        style={{ background: '#161b22', borderColor: '#30363d' }}>
                        {/* 상단: 상태 + D-day */}
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
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

                        {/* 제목 */}
                        <h3 className="font-bold text-sm line-clamp-2 group-hover:text-[#2f81f7] transition-colors">
                          {req.title}
                        </h3>

                        {/* 의뢰자 */}
                        <div className="flex items-center gap-2 text-xs" style={{ color: '#7d8590' }}>
                          <span className="material-symbols-outlined text-xs">person</span>
                          <span>@{req.clientNickname ?? '알 수 없음'}</span>
                        </div>

                        {/* 예산 + 마감 */}
                        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#30363d' }}>
                          <div>
                            <span className="text-xs block" style={{ color: '#7d8590' }}>예산</span>
                            <span className="font-bold text-sm">{formatBudget(req.budgetMin, req.budgetMax)}</span>
                          </div>
                          {req.deadline && (
                            <div className="text-right">
                              <span className="text-xs block" style={{ color: '#7d8590' }}>마감일</span>
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
                      className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:bg-[#21262d] disabled:opacity-50"
                      style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
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
            {/* 의뢰자/작가 서브탭 */}
            <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: '#1c2128' }}>
              {(['client', 'artist'] as const).map(sub => (
                <button key={sub} onClick={() => setMySubTab(sub)}
                  className="px-5 py-2 rounded-lg text-sm font-bold transition-colors"
                  style={{
                    background: mySubTab === sub ? '#292f38' : 'transparent',
                    color: mySubTab === sub ? '#2f81f7' : '#7d8590',
                  }}>
                  {sub === 'client' ? '의뢰한 커미션' : '받은 커미션'}
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>
                    {sub === 'client' ? myCommissions.client.length : myCommissions.artist.length}
                  </span>
                </button>
              ))}
            </div>

            <CommissionList
              commissions={mySubTab === 'client' ? myCommissions.client : myCommissions.artist}
              loading={myLoading}
              perspective={mySubTab}
            />
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
            style={{ background: '#161b22', borderColor: '#30363d' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 id="request-modal-title" className="text-lg font-bold">의뢰 등록하기</h2>
              <button onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-[#21262d]"
                style={{ color: '#7d8590' }}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="의뢰 제목을 입력하세요"
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>설명</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="원하시는 스타일, 참고 레퍼런스, 용도 등을 적어주세요"
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>최소 예산 (원)</label>
                  <input
                    type="number"
                    value={form.budgetMin ?? ''}
                    onChange={e => setForm(f => ({ ...f, budgetMin: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="예: 30000"
                    min={0}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>최대 예산 (원)</label>
                  <input
                    type="number"
                    value={form.budgetMax ?? ''}
                    onChange={e => setForm(f => ({ ...f, budgetMax: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="예: 100000"
                    min={0}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>마감일</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>

              {formError && (
                <p className="text-sm" style={{ color: '#f85149' }}>{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors hover:bg-[#21262d]"
                  style={{ border: '1px solid #30363d', color: '#7d8590' }}>
                  취소
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#2f81f7', color: '#fff' }}>
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
            style={{ background: '#161b22', borderColor: '#30363d' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 id="service-modal-title" className="text-lg font-bold">서비스 등록하기</h2>
              <button onClick={() => setShowServiceModal(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-[#21262d]"
                style={{ color: '#7d8590' }}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleServiceSubmit} className="space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>제목 *</label>
                <input
                  type="text"
                  value={serviceForm.title}
                  onChange={e => setServiceForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 16x16 캐릭터 스프라이트 제작"
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>카테고리</label>
                <select
                  value={serviceForm.category}
                  onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}>
                  {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>설명</label>
                <textarea
                  value={serviceForm.description}
                  onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="작업 범위, 스타일, 제공 항목, 유의사항 등을 적어주세요"
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>

              {/* 가격 유형 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>가격 유형</label>
                <div className="flex gap-2">
                  {([['OPTION', '가격 고정형'], ['QUOTE', '가격 협의형']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setServiceForm(f => ({ ...f, serviceType: val }))}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors"
                      style={serviceForm.serviceType === val
                        ? { background: '#2f81f7', color: '#fff' }
                        : { background: '#0d1117', border: '1px solid #30363d', color: '#7d8590' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 가격 — 유형별 분기 */}
              {serviceForm.serviceType === 'OPTION' ? (
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>기본 가격 (원) *</label>
                  <input
                    type="number"
                    value={serviceForm.basePrice ?? ''}
                    onChange={e => setServiceForm(f => ({ ...f, basePrice: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="예: 30000"
                    min={0}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>최소 가격 (원)</label>
                    <input
                      type="number"
                      value={serviceForm.priceMin ?? ''}
                      onChange={e => setServiceForm(f => ({ ...f, priceMin: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="예: 30000"
                      min={0}
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>최대 가격 (원)</label>
                    <input
                      type="number"
                      value={serviceForm.priceMax ?? ''}
                      onChange={e => setServiceForm(f => ({ ...f, priceMax: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="예: 100000"
                      min={0}
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                    />
                  </div>
                </div>
              )}

              {/* 예상 작업 기간 */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>예상 작업 기간 (일)</label>
                <input
                  type="number"
                  value={serviceForm.estimatedDays ?? ''}
                  onChange={e => setServiceForm(f => ({ ...f, estimatedDays: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="예: 7"
                  min={1}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>

              {serviceError && (
                <p className="text-sm" style={{ color: '#f85149' }}>{serviceError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowServiceModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors hover:bg-[#21262d]"
                  style={{ border: '1px solid #30363d', color: '#7d8590' }}>
                  취소
                </button>
                <button type="submit" disabled={serviceSubmitting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#2f81f7', color: '#fff' }}>
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
