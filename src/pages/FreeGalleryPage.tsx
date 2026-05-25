import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'
import { useBlockStore } from '../store/blockStore'
import { useAuthStore } from '../store/authStore'

const TAGS = ['전체', '풍경', '인물', '아이소메트릭', '애니메이션', '판타지', '사이버펑크', '귀여운']

export default function FreeGalleryPage() {
  const { blockedUserIds, blockedTags, loaded: blocksLoaded } = useBlockStore()
  const { isLoggedIn } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag') ?? '전체'
  const [sort, setSort] = useState('createdAt,desc')
  const [keyword, setKeyword] = useState('')
  const [inputValue, setInputValue] = useState('')

  const handleTagSelect = (tag: string) => {
    setKeyword('')
    setInputValue('')
    if (tag === '전체') setSearchParams({}, { replace: false })
    else setSearchParams({ tag }, { replace: false })
  }
  const [featured, setFeatured] = useState<GalleryPostSummary | null>(null)
  const [artworks, setArtworks] = useState<GalleryPostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 추천 작품 — 페이지 최초 마운트 시 1회만 조회, 태그 필터와 무관
  useEffect(() => {
    galleryApi.getList({ type: 'FREE', page: 0, size: 1, sort: 'likeCount,desc' })
      .then(res => setFeatured(res.data.data.content[0] ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setPage(0)
    setArtworks([])
  }, [keyword, activeTag, sort])

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        let content: GalleryPostSummary[]
        let last: boolean

        if (keyword.trim()) {
          const res = await galleryApi.search(keyword.trim(), { page, size: 9 })
          content = res.data.data.content
          last = res.data.data.last
        } else if (activeTag !== '전체') {
          // 특정 태그 선택 시 서버에서 태그별 조회 — type/sort를 서버에 전달해 페이지네이션 정합성 보장
          const res = await galleryApi.getByTag(activeTag, { page, size: 9, sort, type: 'FREE' })
          content = res.data.data.content
          last = res.data.data.last
        } else {
          const res = await galleryApi.getList({ type: 'FREE', page, size: 9, sort })
          content = res.data.data.content
          last = res.data.data.last
        }

        setArtworks(prev => page === 0 ? content : [...prev, ...content])
        setHasMore(!last)
      } catch {
        // 에러 시 유지
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [page, sort, keyword, activeTag])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setKeyword(inputValue.trim())
  }

  const clearSearch = () => {
    setKeyword('')
    setInputValue('')
    inputRef.current?.focus()
  }

  // 차단 필터 — activeTag 필터는 서버에서 처리되므로 여기서는 차단만 적용
  const filtered = useMemo(() => {
    return artworks.filter(item => {
      // 차단 필터: 로그인 상태이고 차단 목록 로드 완료된 경우에만 적용
      if (isLoggedIn && blocksLoaded) {
        if (blockedUserIds.includes(item.authorId)) return false
        if (item.tags?.some(tag => blockedTags.includes(tag))) return false
      }
      return true
    })
  }, [artworks, blockedUserIds, blockedTags, blocksLoaded, isLoggedIn])


  return (
    <div style={{ background: '#0d1117' }}>
      {/* 히어로 — 검색 중이 아닐 때만 */}
      {!keyword && (
        <div className="w-full relative mb-16" style={{ height: 600 }}>
          {featured?.thumbnailUrl
            ? <img src={featured.thumbnailUrl} alt={featured.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 40%, #2f81f7 100%)' }} />
          }
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
          {featured && (
            <div className="absolute bottom-12 left-12 max-w-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center px-4 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: '#2f81f7', color: '#fff' }}>추천</span>
                <span className="inline-flex items-center px-4 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#e6edf3' }}>자유 갤러리</span>
              </div>
              <h1 className="text-5xl font-bold mb-3 tracking-tight">{featured.title}</h1>
              <p className="text-base mb-2" style={{ color: '#7d8590' }}>by @{featured.authorNickname}</p>
              <div className="flex items-center gap-4 mb-6 text-sm" style={{ color: '#7d8590' }}>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">favorite</span>
                  {featured.likeCount.toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">visibility</span>
                  {featured.viewCount.toLocaleString()}
                </span>
              </div>
              <Link to={`/gallery/${featured.postId}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-opacity hover:opacity-90"
                style={{ background: '#2f81f7', color: '#fff' }}>
                작품 보기
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-8 pb-16">

        {/* 필터 바 + 검색창 (항상 표시) */}
        <div className="flex items-center gap-4 mb-12 flex-wrap">
          {/* 왼쪽: 태그 (검색 중이 아닐 때) 또는 검색 결과 카운트 */}
          {!keyword ? (
            <div className="flex gap-3 flex-wrap">
              {TAGS.map(tag => (
                <button key={tag} onClick={() => handleTagSelect(tag)}
                  className="px-8 py-3 rounded-full text-sm font-bold transition-colors"
                  style={activeTag === tag
                    ? { background: '#2f81f7', color: '#fff' }
                    : { background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
                  #{tag}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#7d8590' }}>
              <span style={{ color: '#e6edf3' }}>"{keyword}"</span> 검색 결과&nbsp;
              {loading ? '...' : `${filtered.length}건`}
            </p>
          )}

          {/* 오른쪽: 검색창 + 정렬 + 작성 버튼 */}
          <div className="ml-auto flex items-center gap-3">
            {isLoggedIn && (
              <button
                onClick={() => navigate('/gallery/create')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                style={{ background: '#2f81f7', color: '#fff' }}>
                <span className="material-symbols-outlined text-base">add</span>
                게시글 등록
              </button>
            )}
            <form onSubmit={handleSearch}>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base"
                  style={{ color: '#7d8590' }}>search</span>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="작품 검색..."
                  className="pl-10 pr-8 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', width: 200 }}
                />
                {(inputValue || keyword) && (
                  <button type="button" onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-white"
                    style={{ color: '#7d8590' }}>
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            </form>
            {!keyword && (
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="appearance-none px-5 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3' }}>
                <option value="createdAt,desc">최신순</option>
                <option value="likeCount,desc">인기순</option>
                <option value="viewCount,desc">조회순</option>
              </select>
            )}
          </div>
        </div>

        {/* 그리드 */}
        {(loading || (isLoggedIn && !blocksLoaded)) && artworks.length === 0 ? (
          <div className="grid grid-cols-3 gap-12">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] rounded-2xl mb-4" style={{ background: '#21262d' }} />
                <div className="h-4 rounded mb-2" style={{ background: '#21262d', width: '60%' }} />
                <div className="h-3 rounded" style={{ background: '#21262d', width: '40%' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-12">
              {filtered.map(item => (
                <Link key={item.postId} to={`/gallery/${item.postId}`} className="group flex flex-col cursor-pointer">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl mb-6 relative bg-[#21262d]">
                    {item.thumbnailUrl
                      ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #161b22, #21262d)' }} />
                    }
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                      <span className="text-white font-bold text-sm">작품 보기</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                      <p className="text-sm font-medium" style={{ color: '#7d8590' }}>by @{item.authorNickname}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm" style={{ color: '#7d8590' }}>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">favorite</span>
                        {item.likeCount.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        {item.viewCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.tags.slice(0, 5).map(tag => (
                        <span key={tag}
                          role="button" tabIndex={0}
                          onClick={e => { e.preventDefault(); handleTagSelect(tag) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTagSelect(tag) } }}
                          className="px-2 py-0.5 rounded-full text-xs cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ background: '#21262d', border: '1px solid #30363d', color: '#7d8590' }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-12">
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="px-10 py-3.5 rounded-xl font-bold transition-colors disabled:opacity-50"
                  style={{ background: '#21262d', color: '#2f81f7', border: '1px solid #30363d' }}>
                  {loading ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <span className="material-symbols-outlined text-5xl" style={{ color: '#30363d' }}>
                  {keyword ? 'search_off' : 'image_not_supported'}
                </span>
                <p style={{ color: '#7d8590' }}>
                  {keyword ? `"${keyword}"에 대한 검색 결과가 없습니다.` : '작품이 없습니다.'}
                </p>
                {keyword && (
                  <button onClick={clearSearch}
                    className="text-sm font-bold hover:underline"
                    style={{ color: '#2f81f7' }}>
                    전체 작품 보기
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
