import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  requestPostApi, type RequestPostSummary, type RequestPostCreateRequest,
  artistServiceApi, type ArtistServiceSummary,
} from '../api/commissionApi'
import { useAuthStore } from '../store/authStore'

const STYLES = ['All Styles', 'Character', 'Environment', 'Animation', 'Game Asset', 'Portrait']

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

function formatServicePrice(service: ArtistServiceSummary) {
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

function formatBudget(min?: number | null, max?: number | null) {
  if (!min && !max) return '협의'
  if (min && max) return `₩${min.toLocaleString()} ~ ₩${max.toLocaleString()}`
  if (min) return `₩${min.toLocaleString()} ~`
  return `~ ₩${max!.toLocaleString()}`
}

export default function CommissionPage() {
  const { isLoggedIn } = useAuthStore()
  const [tab, setTab] = useState<'artists' | 'requests'>('artists')
  const [activeStyle, setActiveStyle] = useState('All Styles')

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

  useEffect(() => {
    if (tab === 'artists') fetchArtists(0)
    if (tab === 'requests') fetchRequests(0)
  }, [tab])

  useEffect(() => {
    setSearchInput('')
    setSearchKeyword('')
  }, [tab])

  const fetchArtists = async (page: number) => {
    setArtistLoading(true)
    try {
      const res = await artistServiceApi.getOpenList({ page, size: 9 })
      const d = res.data.data
      if (page === 0) {
        setArtists(d.content)
      } else {
        setArtists(prev => [...prev, ...d.content])
      }
      setArtistPage(page)
      setArtistHasMore(!d.last)
    } catch {
      // 무시
    } finally {
      setArtistLoading(false)
    }
  }

  const fetchRequests = async (page: number) => {
    setReqLoading(true)
    try {
      const res = await requestPostApi.getOpenList({ page, size: 9 })
      const d = res.data.data
      if (page === 0) {
        setRequests(d.content)
      } else {
        setRequests(prev => [...prev, ...d.content])
      }
      setReqPage(page)
      setReqHasMore(!d.last)
    } catch {
      // 무시
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
        setTab('requests')
      }
    } catch {
      setFormError('의뢰 등록에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredArtists = searchKeyword
    ? artists.filter(a =>
        a.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (a.artistNickname ?? '').toLowerCase().includes(searchKeyword.toLowerCase())
      )
    : artists

  const filteredRequests = searchKeyword
    ? requests.filter(r => r.title.toLowerCase().includes(searchKeyword.toLowerCase()))
    : requests

  return (
    <div style={{ background: '#0d1117', color: '#e6edf3' }}>
      {/* 헤더 */}
      <div className="border-b px-8 pt-10 pb-8" style={{ borderColor: '#30363d' }}>
        <div className="max-w-[1440px] mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Commission</h1>
              <p style={{ color: '#7d8590' }}>원하는 픽셀아트를 작가에게 의뢰하거나, 서비스를 등록하세요</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleOpenModal}
                className="px-5 py-2.5 rounded-xl font-bold text-sm transition-colors hover:bg-[#21262d]"
                style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
                의뢰 등록하기
              </button>
              <button className="px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                style={{ background: '#2f81f7', color: '#fff' }}>서비스 등록하기</button>
            </div>
          </div>
          {/* 탭 */}
          <div className="flex gap-1 rounded-xl p-1 w-fit mt-8" style={{ background: '#1c2128' }}>
            {[['artists', '작가 찾기'], ['requests', '의뢰 찾기']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key as typeof tab)}
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

        {/* 필터 바 + 검색창 */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          {!searchKeyword ? (
            <div className="flex gap-2 flex-wrap">
              {STYLES.map(s => (
                <button key={s} onClick={() => setActiveStyle(s)}
                  className="px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
                  style={activeStyle === s
                    ? { background: '#2f81f7', color: '#fff' }
                    : { background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#7d8590' }}>
              <span style={{ color: '#e6edf3' }}>"{searchKeyword}"</span> 검색 결과&nbsp;
              {tab === 'artists'
                ? `${filteredArtists.length}개`
                : `${filteredRequests.length}건`}
            </p>
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
              <select className="appearance-none px-5 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3' }}>
                <option>최신순</option>
                <option>낮은 예산순</option>
                <option>마감 임박순</option>
              </select>
            )}
          </div>
        </div>

        {/* 작가 찾기 탭 */}
        {tab === 'artists' && (
          artistLoading && artists.length === 0 ? (
            <div className="grid grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border animate-pulse"
                  style={{ background: '#161b22', borderColor: '#30363d', height: 280 }} />
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
                      onClick={() => { if (!isLoggedIn) { alert('로그인이 필요합니다.'); return } }}
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
                {filteredArtists.map(service => {
                  const isOpen = service.status === 'OPEN'
                  const gradient = getAvatarGradient(service.serviceId)
                  return (
                    <div key={service.serviceId}
                      className="rounded-2xl overflow-hidden border transition-shadow hover:shadow-lg"
                      style={{ background: '#161b22', borderColor: '#30363d' }}>
                      {/* 상단 배너 */}
                      <div className="h-28 flex items-center justify-center"
                        style={{ background: gradient }}>
                        {service.artistProfileImageUrl ? (
                          <img src={service.artistProfileImageUrl} alt={service.artistNickname ?? ''}
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20" />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
                            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                            {(service.artistNickname ?? '?')[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="font-bold block">{service.artistNickname ?? '알 수 없음'}</span>
                            <span className="text-xs" style={{ color: '#7d8590' }}>
                              {service.serviceType === 'OPTION' ? '가격 고정형' : '가격 협의형'}
                            </span>
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-bold border"
                            style={isOpen
                              ? { background: 'rgba(63,185,80,0.1)', color: '#3fb950', borderColor: 'rgba(63,185,80,0.3)' }
                              : { background: '#21262d', color: '#7d8590', borderColor: '#30363d' }}>
                            {isOpen ? 'Open' : 'Closed'}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold mb-4 line-clamp-2">{service.title}</h3>

                        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: '#30363d' }}>
                          <div>
                            <span className="text-xs block" style={{ color: '#7d8590' }}>
                              {service.estimatedDays ? `예상 ${service.estimatedDays}일` : '기간 협의'}
                            </span>
                            <p className="font-bold text-sm">{formatServicePrice(service)}</p>
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
                })}
              </div>

              {artistHasMore && !searchKeyword && (
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

                {reqHasMore && !searchKeyword && (
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
      </div>

      {/* 의뢰 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="w-full max-w-lg rounded-2xl border p-6"
            style={{ background: '#161b22', borderColor: '#30363d' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">의뢰 등록하기</h2>
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
    </div>
  )
}
