import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { assetApi, type AssetSummary } from '../api/assetApi'

const CATEGORIES = ['전체', '캐릭터', '타일셋', '배경/환경', 'UI/아이콘', '스프라이트', '이펙트']

export default function AssetStorePage() {
  const [activeCategory, setActiveCategory] = useState('전체')
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all')
  const [sort, setSort] = useState('createdAt,desc')
  const [keyword, setKeyword] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalStats, setTotalStats] = useState({ total: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPage(0)
    setAssets([])
  }, [priceFilter, activeCategory, sort, keyword])

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        let content: AssetSummary[]
        let last: boolean
        let totalElements: number

        if (keyword.trim()) {
          const res = await assetApi.search(keyword.trim(), { page, size: 8 })
          content = res.data.data.content
          last = res.data.data.last
          totalElements = res.data.data.totalElements
        } else {
          const isFree = priceFilter === 'all' ? undefined : priceFilter === 'free'
          const res = await assetApi.getList({ isFree, page, size: 8, sort })
          content = res.data.data.content
          last = res.data.data.last
          totalElements = res.data.data.totalElements
        }

        setAssets(prev => page === 0 ? content : [...prev, ...content])
        setHasMore(!last)
        if (page === 0) setTotalStats({ total: totalElements })
      } catch {
        // 에러 시 유지
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [page, priceFilter, sort, keyword])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setKeyword(inputValue.trim())
  }

  const clearSearch = () => {
    setKeyword('')
    setInputValue('')
    inputRef.current?.focus()
  }

  return (
    <div style={{ background: '#0d1117' }}>
      {/* 히어로 */}
      <div className="relative py-20 px-8 text-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(47,129,247,0.3) 0%, #161b22 50%, #0d1117 100%)' }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle, #2f81f7 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative z-10">
          <h1 className="text-5xl font-bold mb-3 tracking-tight">에셋 스토어</h1>
          <p className="text-base mb-8" style={{ color: '#7d8590' }}>최고의 픽셀아트 에셋을 발견하고, 만들고, 공유하세요</p>
          <div className="flex justify-center gap-10">
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: '#2f81f7' }}>
                {totalStats.total > 0 ? totalStats.total.toLocaleString() : '—'}
              </p>
              <p className="text-sm mt-1" style={{ color: '#7d8590' }}>에셋</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-8 py-8 pb-16">

        {/* 필터 바 + 검색창 (항상 표시) */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          {/* 왼쪽: 필터 칩 (검색 중이 아닐 때) 또는 검색 결과 카운트 */}
          {!keyword ? (
            <>
              <div className="flex gap-2">
                {([['all', '전체'], ['free', '무료'], ['paid', '유료']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setPriceFilter(val)}
                    className="px-5 py-2.5 rounded-full text-sm font-bold transition-colors"
                    style={priceFilter === val
                      ? { background: '#2f81f7', color: '#fff' }
                      : { background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="w-px h-6" style={{ background: '#30363d' }} />
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className="px-5 py-2.5 rounded-full text-sm font-bold transition-colors"
                    style={activeCategory === cat
                      ? { background: '#2f81f7', color: '#fff' }
                      : { background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
                    {cat}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: '#7d8590' }}>
              <span style={{ color: '#e6edf3' }}>"{keyword}"</span> 검색 결과&nbsp;
              {loading ? '...' : `${totalStats.total}건`}
            </p>
          )}

          {/* 오른쪽: 검색창 + 정렬 */}
          <div className="ml-auto flex items-center gap-3">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base"
                  style={{ color: '#7d8590' }}>search</span>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="에셋 검색..."
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
                <option value="downloadCount,desc">인기순</option>
                <option value="price,asc">낮은 가격순</option>
                <option value="price,desc">높은 가격순</option>
              </select>
            )}
          </div>
        </div>

        {/* 그리드 */}
        {loading && assets.length === 0 ? (
          <div className="grid grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl overflow-hidden" style={{ background: '#21262d' }}>
                <div className="aspect-square" style={{ background: '#30363d' }} />
                <div className="p-4 space-y-2">
                  <div className="h-3 rounded" style={{ background: '#30363d', width: '70%' }} />
                  <div className="h-3 rounded" style={{ background: '#30363d', width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-5">
              {assets.map(item => (
                <Link key={item.assetId} to={`/assets/${item.assetId}`}
                  className="group rounded-2xl overflow-hidden border transition-all hover:border-[#2f81f7]/50 hover:-translate-y-1"
                  style={{ background: '#21262d', borderColor: '#30363d' }}>
                  <div className="aspect-square checkerboard relative bg-[#161b22]">
                    {item.thumbnailUrl
                      ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #161b22, #21262d)' }} />
                    }
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold border"
                      style={item.isFree
                        ? { background: 'rgba(63,185,80,0.2)', color: '#3fb950', borderColor: 'rgba(63,185,80,0.3)' }
                        : { background: 'rgba(47,129,247,0.2)', color: '#2f81f7', borderColor: 'rgba(47,129,247,0.3)' }}>
                      {item.isFree ? '무료' : `₩${item.price.toLocaleString()}`}
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-4 py-2 rounded-lg text-sm font-bold"
                        style={{ background: '#2f81f7', color: '#fff' }}>
                        {item.isFree ? '무료 받기' : '구매하기'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-sm mb-1 truncate">{item.title}</h3>
                    <p className="text-xs mb-3" style={{ color: '#7d8590' }}>@{item.authorNickname}</p>
                    <div className="flex items-center gap-3 text-xs" style={{ color: '#7d8590' }}>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">favorite</span>
                        {item.likeCount.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">download</span>
                        {item.downloadCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="px-10 py-3.5 rounded-xl font-bold disabled:opacity-50"
                  style={{ background: '#21262d', color: '#2f81f7', border: '1px solid #30363d' }}>
                  {loading ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}

            {!loading && assets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <span className="material-symbols-outlined text-5xl" style={{ color: '#30363d' }}>
                  {keyword ? 'search_off' : 'inventory_2'}
                </span>
                <p style={{ color: '#7d8590' }}>
                  {keyword ? `"${keyword}"에 대한 검색 결과가 없습니다.` : '에셋이 없습니다.'}
                </p>
                {keyword && (
                  <button onClick={clearSearch}
                    className="text-sm font-bold hover:underline"
                    style={{ color: '#2f81f7' }}>
                    전체 에셋 보기
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
