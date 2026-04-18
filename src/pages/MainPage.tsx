import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'

// thumbnailUrl 없을 때 postId 기반 그라디언트 placeholder
const GRADIENTS = [
  'linear-gradient(135deg, #6a0dad, #1a1a2e, #0d4f8c)',
  'linear-gradient(135deg, #1a3a5c, #2d6a8f, #e8f4f8)',
  'linear-gradient(135deg, #ff6b35, #f7c59f, #4ecdc4)',
  'linear-gradient(135deg, #2c1810, #8b4513, #d4a574)',
  'linear-gradient(135deg, #f0883e, #c0392b, #2c3e50)',
  'linear-gradient(135deg, #0d2818, #1a5c2a, #2d8f3e)',
  'linear-gradient(135deg, #1a0a2e, #4a1060, #8b2de0)',
  'linear-gradient(135deg, #0a1628, #0d3a6b, #1a6bbf)',
]
function getBg(post: GalleryPostSummary) {
  return post.thumbnailUrl ?? GRADIENTS[post.postId % GRADIENTS.length]
}
function isBgGradient(post: GalleryPostSummary) {
  return !post.thumbnailUrl
}

// 게시물 목록에서 중복 없이 작가 추출
function extractAuthors(posts: GalleryPostSummary[]) {
  const seen = new Set<number>()
  return posts
    .filter(p => {
      if (seen.has(p.authorId)) return false
      seen.add(p.authorId)
      return true
    })
    .slice(0, 5)
    .map(p => ({
      id: p.authorId,
      nickname: p.authorNickname,
      profileImageUrl: p.authorProfileImageUrl,
      gradient: GRADIENTS[p.authorId % GRADIENTS.length],
    }))
}

// 스켈레톤 카드
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg ${className ?? ''}`}
      style={{ background: '#21262d' }} />
  )
}

export default function MainPage() {
  const [trending, setTrending] = useState<GalleryPostSummary[]>([])
  const [recentlyAdded, setRecentlyAdded] = useState<GalleryPostSummary[]>([])
  const [hotArtworks, setHotArtworks] = useState<GalleryPostSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      galleryApi.getList({ page: 0, size: 6, sort: 'viewCount,desc' }),
      galleryApi.getList({ page: 0, size: 6, sort: 'createdAt,desc' }),
      galleryApi.getList({ page: 0, size: 7, sort: 'likeCount,desc' }),
    ])
      .then(([trendRes, recentRes, hotRes]) => {
        if (trendRes.status === 'fulfilled') setTrending(trendRes.value.data.data.content)
        else console.error('트렌딩 로드 실패:', trendRes.reason)
        if (recentRes.status === 'fulfilled') setRecentlyAdded(recentRes.value.data.data.content)
        else console.error('최신 로드 실패:', recentRes.reason)
        if (hotRes.status === 'fulfilled') setHotArtworks(hotRes.value.data.data.content)
        else console.error('인기 로드 실패:', hotRes.reason)
      })
      .finally(() => setLoading(false))
  }, [])

  const popularAuthors = useMemo(
    () => extractAuthors([...trending, ...recentlyAdded]),
    [trending, recentlyAdded]
  )

  return (
    <div className="pb-16" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-[1440px] mx-auto px-8 pt-8 flex gap-8 items-start">

        {/* ── 좌측 사이드바: 인기 작가 ── */}
        <aside className="w-52 shrink-0 sticky top-24 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: 'var(--primary)' }}>
            Popular Artists
          </h3>

          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="w-10 h-10 rounded-full animate-pulse shrink-0" style={{ background: '#21262d' }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded animate-pulse" style={{ background: '#21262d', width: '70%' }} />
                    <div className="h-2.5 rounded animate-pulse" style={{ background: '#21262d', width: '40%' }} />
                  </div>
                </div>
              ))
            : popularAuthors.map(author => (
                <Link key={author.id} to={`/profile/${author.nickname}`}
                  className="flex items-center gap-3 p-2 rounded-xl group transition-colors hover:bg-[#21262d]">
                  {author.profileImageUrl ? (
                    <img src={author.profileImageUrl} alt={author.nickname}
                      className="w-10 h-10 rounded-full shrink-0 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full shrink-0"
                      style={{ background: author.gradient }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate group-hover:text-[var(--primary)] transition-colors">
                      {author.nickname}
                    </p>
                  </div>
                </Link>
              ))
          }

          <Link to="/gallery/free"
            className="block text-center text-xs font-bold py-2 rounded-lg mt-2 transition-colors hover:text-[var(--primary)]"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>
            View All Artists →
          </Link>
        </aside>

        {/* ── 중앙: 갤러리 피드 ── */}
        <main className="flex-1 min-w-0 space-y-14">

          {/* Trending Artworks */}
          <section>
            <div className="flex justify-between items-end mb-7">
              <div>
                <span className="block text-xs font-bold tracking-widest uppercase mb-1.5"
                  style={{ color: 'var(--primary)' }}>Curated Selection</span>
                <h2 className="text-3xl font-bold tracking-tight">Trending Artworks</h2>
              </div>
              <Link to="/gallery/free"
                className="flex items-center gap-1.5 font-semibold text-sm hover:underline underline-offset-4"
                style={{ color: 'var(--primary)' }}>
                Explore All
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i}>
                      <SkeletonCard className="aspect-[4/3] mb-3" />
                      <div className="h-4 rounded animate-pulse mb-1.5" style={{ background: '#21262d', width: '60%' }} />
                      <div className="h-3 rounded animate-pulse" style={{ background: '#21262d', width: '35%' }} />
                    </div>
                  ))
                : trending.map(item => (
                    <Link key={item.postId} to={`/gallery/${item.postId}`} className="group cursor-pointer">
                      <div className="overflow-hidden mb-3 aspect-[4/3] rounded-lg"
                        style={{
                          background: isBgGradient(item) ? getBg(item) : undefined,
                          clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
                        }}>
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            style={{ imageRendering: 'pixelated' }} />
                        ) : (
                          <div className="w-full h-full transition-transform duration-500 group-hover:scale-110" />
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-base font-bold line-clamp-1">{item.title}</h3>
                          <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            by {item.authorNickname}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="material-symbols-outlined text-sm">favorite</span>
                          {item.likeCount.toLocaleString()}
                        </div>
                      </div>
                    </Link>
                  ))
              }
            </div>
          </section>

          {/* Recently Added */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Recently Added</h2>
              <Link to="/gallery/free"
                className="text-xs font-bold hover:underline"
                style={{ color: 'var(--primary)' }}>
                View All →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} className="aspect-square" />
                  ))
                : recentlyAdded.map(item => (
                    <Link key={item.postId} to={`/gallery/${item.postId}`}
                      className="aspect-square rounded-lg overflow-hidden relative group"
                      style={{ background: isBgGradient(item) ? getBg(item) : undefined }}>
                      {item.thumbnailUrl && (
                        <img src={item.thumbnailUrl} alt={item.title}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: 'pixelated' }} />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                        <span className="text-white font-bold text-sm text-center line-clamp-2">{item.title}</span>
                        <span className="text-xs" style={{ color: '#c9d1d9' }}>by {item.authorNickname}</span>
                      </div>
                    </Link>
                  ))
              }
            </div>
          </section>

        </main>

        {/* ── 우측 사이드바: 핫한 작품 ── */}
        <aside className="w-56 shrink-0 sticky top-24">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: 'var(--primary)' }}>
            🔥 Hot Right Now
          </h3>

          <div className="space-y-3">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 shrink-0" />
                    <div className="w-12 h-12 rounded-lg animate-pulse shrink-0" style={{ background: '#21262d' }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded animate-pulse" style={{ background: '#21262d' }} />
                      <div className="h-2.5 rounded animate-pulse" style={{ background: '#21262d', width: '60%' }} />
                    </div>
                  </div>
                ))
              : hotArtworks.map((item, idx) => (
                  <Link key={item.postId} to={`/gallery/${item.postId}`}
                    className="flex items-center gap-3 group">
                    <span className="text-sm font-bold italic w-4 shrink-0 text-center"
                      style={{ color: idx === 0 ? 'var(--primary)' : 'var(--text-secondary)' }}>
                      {idx + 1}
                    </span>
                    <div className="w-12 h-12 rounded-lg shrink-0 overflow-hidden"
                      style={{ background: isBgGradient(item) ? getBg(item) : undefined }}>
                      {item.thumbnailUrl && (
                        <img src={item.thumbnailUrl} alt={item.title}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: 'pixelated' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate group-hover:text-[var(--primary)] transition-colors leading-tight">
                        {item.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        @{item.authorNickname}
                      </p>
                      <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--accent)' }}>
                        ♥ {item.likeCount.toLocaleString()}
                      </p>
                    </div>
                  </Link>
                ))
            }
          </div>

          <Link to="/gallery/free"
            className="block text-center text-xs font-bold py-2 rounded-lg mt-4 transition-colors hover:text-[var(--primary)]"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>
            View More →
          </Link>
        </aside>

      </div>
    </div>
  )
}
