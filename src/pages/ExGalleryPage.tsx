import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'
import { useBlockStore } from '../store/blockStore'
import { useAuthStore } from '../store/authStore'
import GalleryCreateModal from '../components/GalleryCreateModal'
import { useEmailGate } from '../hooks/useEmailGate'
import TagBlockMenu from '../components/TagBlockMenu'

export default function ExGalleryPage() {
  const { blockedUserIds, blockedTags, loaded: blocksLoaded } = useBlockStore()
  const { isLoggedIn } = useAuthStore()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const { blocked: gateBlocked, guard: gate, gateProps } = useEmailGate()
  const [artworks, setArtworks] = useState<GalleryPostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('createdAt,desc')
  const [keyword, setKeyword] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPage(0)
    setArtworks([])
  }, [sort, keyword])

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        let content: GalleryPostSummary[]
        let last: boolean

        if (keyword.trim()) {
          const res = await galleryApi.search(keyword.trim(), { page, size: 9 })
          const filtered = res.data.data.content.filter(p => p.galleryType === 'DEDICATED')
          content = filtered
          last = res.data.data.last
        } else {
          const res = await galleryApi.getList({ type: 'DEDICATED', page, size: 9, sort })
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
  }, [page, sort, keyword])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setKeyword(inputValue.trim())
  }

  const clearSearch = () => {
    setKeyword('')
    setInputValue('')
    inputRef.current?.focus()
  }

  // 차단 필터 — 로그인 상태이고 목록 로드 완료된 경우에만 적용 (로드 전 플래시 방지)
  const filtered = useMemo(() => {
    if (!isLoggedIn || !blocksLoaded) return artworks
    return artworks.filter(item =>
      !blockedUserIds.includes(item.authorId) &&
      !item.tags?.some(tag => blockedTags.includes(tag))
    )
  }, [artworks, blockedUserIds, blockedTags, blocksLoaded, isLoggedIn])

  // TOP3/히어로 — filtered 기반이므로 차단 변경 즉시 반영
  const top3 = useMemo(() =>
    [...filtered].sort((a, b) => b.likeCount - a.likeCount).slice(0, 3)
  , [filtered])

  const featured = top3[0]

  return (
    <div style={{ background: 'var(--color-background)' }}>
      {/* 히어로 — 검색 중이 아닐 때만 */}
      {!keyword && (
        <div className="relative rounded-xl overflow-hidden mx-8 mt-8 mb-16" style={{ aspectRatio: '21/9' }}>
          {featured?.thumbnailUrl
            ? <img src={featured.thumbnailUrl} alt={featured.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
            : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #0a1628, #1a3a5c, #4a4abf)' }} />
          }
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.7), transparent)' }} />
          <div className="absolute inset-0 flex flex-col justify-end p-12">
            <span className="inline-flex w-fit items-center px-4 py-1.5 rounded-lg text-sm font-bold mb-4"
              style={{ background: 'var(--color-accent)', color: '#fff' }}>전용 갤러리</span>
            <h2 className="text-4xl font-bold mb-2">{featured?.title ?? '—'}</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
              {featured ? `by @${featured.authorNickname} · ${featured.likeCount.toLocaleString()} 좋아요` : ''}
            </p>
            {featured && (
              <Link to={`/gallery/${featured.postId}`}
                className="inline-flex w-fit items-center gap-2 px-6 py-3 rounded-xl font-bold hover:opacity-90"
                style={{ background: 'var(--color-primary)', color: '#fff' }}>
                작품 보기
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-8 pb-16 space-y-12">

        {/* 필터 바 + 검색창 (항상 표시) */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* 왼쪽: 검색 중이면 결과 카운트, 아니면 빈 공간 */}
          {keyword && (
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span style={{ color: 'var(--color-on-surface)' }}>"{keyword}"</span> 검색 결과&nbsp;
              {loading ? '...' : `${filtered.length}건`}
            </p>
          )}

          {/* 오른쪽: 검색창 + 정렬 + 작성 버튼 */}
          <div className="ml-auto flex items-center gap-3">
            {isLoggedIn && (
              <button
                onClick={gate(() => setCreateModalOpen(true))}
                {...gateProps}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-opacity ${gateBlocked ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                style={{ background: 'var(--color-primary)', color: '#fff' }}>
                <span className="material-symbols-outlined text-base">{gateBlocked ? 'lock' : 'add'}</span>
                게시글 등록
              </button>
            )}
            <form onSubmit={handleSearch}>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base"
                  style={{ color: 'var(--color-on-surface-variant)' }}>search</span>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="전용 갤러리 검색..."
                  className="pl-10 pr-8 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)', width: 220 }}
                />
                {(inputValue || keyword) && (
                  <button type="button" onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-white"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
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
                style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                <option value="createdAt,desc">최신순</option>
                <option value="likeCount,desc">인기순</option>
                <option value="viewCount,desc">조회순</option>
              </select>
            )}
          </div>
        </div>

        {/* TOP 3 — 검색 중이 아닐 때만 */}
        {!keyword && top3.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-8">🏆 인기 작품</h2>
            <div className="grid grid-cols-3 gap-8">
              {top3.map((item, idx) => (
                <Link key={item.postId} to={`/gallery/${item.postId}`}
                  className="relative rounded-xl flex flex-col gap-4 border p-4 transition-transform hover:-translate-y-1 cursor-pointer"
                  style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg z-10"
                    style={{
                      background: idx === 0 ? 'var(--color-primary)' : 'var(--color-surface-container)',
                      color: idx === 0 ? '#fff' : 'var(--color-on-surface-variant)',
                      border: '1px solid var(--color-outline)',
                    }}>
                    {idx + 1}
                  </div>
                  <div className="w-full aspect-square overflow-hidden rounded-lg bg-surface">
                    {item.thumbnailUrl
                      ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-container))' }} />
                    }
                  </div>
                  <div>
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                      @{item.authorNickname} · {item.likeCount.toLocaleString()} 좋아요
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 그리드 */}
        {(loading || (isLoggedIn && !blocksLoaded)) && artworks.length === 0 ? (
          <div className="grid grid-cols-3 gap-12">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] rounded-xl mb-4" style={{ background: 'var(--color-surface-container)' }} />
                <div className="h-4 rounded mb-2" style={{ background: 'var(--color-surface-container)', width: '60%' }} />
                <div className="h-3 rounded" style={{ background: 'var(--color-surface-container)', width: '40%' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-12">
              {filtered.map(item => (
                <Link key={item.postId} to={`/gallery/${item.postId}`} className="group relative flex flex-col cursor-pointer">
                  <TagBlockMenu tags={item.tags} />
                  <div className="aspect-[4/3] overflow-hidden mb-4 relative bg-surface-container"
                    style={{ clipPath: 'polygon(0 4px,4px 4px,4px 0,calc(100% - 4px) 0,calc(100% - 4px) 4px,100% 4px,100% calc(100% - 4px),calc(100% - 4px) calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,4px calc(100% - 4px),0 calc(100% - 4px))' }}>
                    {item.thumbnailUrl
                      ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-container))' }} />
                    }
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-bold text-sm">작품 보기</span>
                    </div>
                  </div>
                  <h3 className="font-bold mb-1">{item.title}</h3>
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    @{item.authorNickname} · {item.likeCount.toLocaleString()} 좋아요
                  </p>
                </Link>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center">
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="px-10 py-3.5 rounded-xl font-bold disabled:opacity-50"
                  style={{ background: 'var(--color-surface-container)', color: 'var(--color-primary)', border: '1px solid var(--color-outline)' }}>
                  {loading ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-outline)' }}>
                  {keyword ? 'search_off' : 'image_not_supported'}
                </span>
                <p style={{ color: 'var(--color-on-surface-variant)' }}>
                  {keyword ? `"${keyword}"에 대한 검색 결과가 없습니다.` : '전용 갤러리 작품이 없습니다.'}
                </p>
                {keyword && (
                  <button onClick={clearSearch}
                    className="text-sm font-bold hover:underline"
                    style={{ color: 'var(--color-primary)' }}>
                    전체 작품 보기
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <GalleryCreateModal
        type="DEDICATED"
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <footer className="border-t py-12 px-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
        <div className="max-w-[1440px] mx-auto flex justify-between items-center">
          <span className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>PixelHub</span>
          <div className="flex gap-6 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            {['이용약관', '개인정보처리방침', '고객지원', '작가센터'].map(l => (
              <a key={l} href="#" className="hover:text-white transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
