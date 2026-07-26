import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'
import { assetApi, type AssetSummary } from '../api/assetApi'
import { artistServiceApi, commissionApi, type ArtistServiceSummary, type CommissionSummary } from '../api/commissionApi'
import { useBlockStore } from '../store/blockStore'
import { useAuthStore } from '../store/authStore'

// thumbnailUrl 없을 때 postId 기반 그라디언트 placeholder
const GRADIENTS = [
  'linear-gradient(135deg, #6a0dad, var(--color-surface-container), #0d4f8c)',
  'linear-gradient(135deg, #1a3a5c, #2d6a8f, #e8f4f8)',
  'linear-gradient(135deg, #ff6b35, #f7c59f, #4ecdc4)',
  'linear-gradient(135deg, #2c1810, #8b4513, #d4a574)',
  'linear-gradient(135deg, var(--color-accent), #c0392b, #2c3e50)',
  'linear-gradient(135deg, #0d2818, #1a5c2a, #2d8f3e)',
  'linear-gradient(135deg, #1a0a2e, #4a1060, #8b2de0)',
  'linear-gradient(135deg, #0a1628, #0d3a6b, #1a6bbf)',
]
function gradientOf(id: number) {
  return GRADIENTS[id % GRADIENTS.length]
}

const COMMISSION_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: '진행 중',
  REVIEW: '검토 중',
}

function formatServicePrice(s: ArtistServiceSummary) {
  if (s.serviceType === 'OPTION' && s.basePrice != null) return `₩${s.basePrice.toLocaleString()} ~`
  if (s.priceMin != null && s.priceMax != null) return `₩${s.priceMin.toLocaleString()} ~ ₩${s.priceMax.toLocaleString()}`
  if (s.priceMin != null) return `₩${s.priceMin.toLocaleString()} ~`
  if (s.priceMax != null) return `~ ₩${s.priceMax.toLocaleString()}`
  return '가격 협의'
}

// 진행 중 거래 (역할 표시용)
interface ActiveCommission extends CommissionSummary {
  role: 'client' | 'artist'
}

// 스켈레톤 카드
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg ${className ?? ''}`}
      style={{ background: 'var(--color-surface-container)' }} />
  )
}

// 섹션 헤더 (제목 + 전체 보기 링크)
function SectionHeader({ eyebrow, title, to, linkLabel }: { eyebrow?: string; title: string; to: string; linkLabel: string }) {
  return (
    <div className="flex justify-between items-end mb-6">
      <div>
        {eyebrow && (
          <span className="block text-xs font-bold tracking-widest uppercase mb-1.5"
            style={{ color: 'var(--color-primary)' }}>{eyebrow}</span>
        )}
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <Link to={to}
        className="flex items-center gap-1.5 font-semibold text-sm hover:underline underline-offset-4"
        style={{ color: 'var(--color-primary)' }}>
        {linkLabel}
        <span className="material-symbols-outlined text-base">arrow_forward</span>
      </Link>
    </div>
  )
}

export default function MainPage() {
  const { blockedUserIds, blockedTags, loaded: blocksLoaded } = useBlockStore()
  const { isLoggedIn } = useAuthStore()

  const [hot, setHot] = useState<GalleryPostSummary[]>([])
  const [recent, setRecent] = useState<GalleryPostSummary[]>([])
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [services, setServices] = useState<ArtistServiceSummary[]>([])
  const [active, setActive] = useState<ActiveCommission[]>([])
  const [loading, setLoading] = useState(true)

  // 로그인 사용자는 차단 목록 로드 완료까지 스켈레톤 유지 (차단 항목 flash 방지)
  const showSkeleton = loading || (isLoggedIn && !blocksLoaded)

  // 차단 유저/태그 포함 작품 숨김 (로그인 + 차단목록 로드 완료 시에만)
  const blockActive = isLoggedIn && blocksLoaded
  const filterPosts = useCallback(
    (posts: GalleryPostSummary[]) =>
      blockActive
        ? posts.filter(p =>
            !blockedUserIds.includes(p.authorId) &&
            !p.tags?.some(tag => blockedTags.includes(tag))
          )
        : posts,
    [blockActive, blockedUserIds, blockedTags]
  )

  // 공개 콘텐츠 로드 (갤러리 인기/최근 + 신규 에셋 + 모집 중 커미션)
  useEffect(() => {
    Promise.allSettled([
      // 자유 갤러리만 — 히어로/최근 카드의 "전체 보기"가 /gallery/free 로 가므로 콘텐츠도 FREE로 일치
      galleryApi.getList({ type: 'FREE', page: 0, size: 7, sort: 'likeCount,desc' }),
      galleryApi.getList({ type: 'FREE', page: 0, size: 6, sort: 'createdAt,desc' }),
      assetApi.getList({ page: 0, size: 4, sort: 'createdAt,desc' }),
      artistServiceApi.getOpenList({ page: 0, size: 4, sort: 'createdAt,desc' }),
    ])
      .then(([hotRes, recentRes, assetRes, serviceRes]) => {
        if (hotRes.status === 'fulfilled') setHot(hotRes.value.data.data.content)
        else console.error('인기 작품 로드 실패:', hotRes.reason)
        if (recentRes.status === 'fulfilled') setRecent(recentRes.value.data.data.content)
        else console.error('최근 작품 로드 실패:', recentRes.reason)
        if (assetRes.status === 'fulfilled') setAssets(assetRes.value.data.data.content)
        else console.error('신규 에셋 로드 실패:', assetRes.reason)
        if (serviceRes.status === 'fulfilled') setServices(serviceRes.value.data.data.content)
        else console.error('커미션 서비스 로드 실패:', serviceRes.reason)
      })
      .finally(() => setLoading(false))
  }, [])

  // 진행 중 거래 (로그인 시) — 의뢰자/작가 양쪽 합산, IN_PROGRESS/REVIEW만
  useEffect(() => {
    if (!isLoggedIn) { setActive([]); return }
    // 로그아웃(또는 계정 전환)으로 effect가 재실행되면 이전 요청 결과는 버린다.
    // (안 그러면 뒤늦게 도착한 이전 사용자의 거래 정보가 로그아웃 후 노출될 수 있음)
    let ignore = false
    Promise.allSettled([
      commissionApi.getMyListAsClient({ size: 20 }),
      commissionApi.getMyListAsArtist({ size: 20 }),
    ]).then(([c, a]) => {
      if (ignore) return
      const merged: ActiveCommission[] = []
      if (c.status === 'fulfilled')
        merged.push(...c.value.data.data.content.map(x => ({ ...x, role: 'client' as const })))
      if (a.status === 'fulfilled')
        merged.push(...a.value.data.data.content.map(x => ({ ...x, role: 'artist' as const })))
      const seen = new Set<number>()
      setActive(
        merged
          .filter(x => (x.status === 'IN_PROGRESS' || x.status === 'REVIEW'))
          .filter(x => (seen.has(x.commissionId) ? false : (seen.add(x.commissionId), true)))
          .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())
      )
    })
    return () => { ignore = true }
  }, [isLoggedIn])

  const visibleHot = useMemo(() => filterPosts(hot), [hot, filterPosts])
  const visibleRecent = useMemo(() => filterPosts(recent), [recent, filterPosts])
  const visibleAssets = useMemo(
    () =>
      blockActive
        ? assets.filter(a =>
            !blockedUserIds.includes(a.authorId) &&
            !a.tags?.some(tag => blockedTags.includes(tag))
          )
        : assets,
    [assets, blockActive, blockedUserIds, blockedTags]
  )
  const visibleServices = useMemo(
    () => (blockActive ? services.filter(s => !blockedUserIds.includes(s.artistId)) : services),
    [services, blockActive, blockedUserIds]
  )

  // 히어로 = 인기 1위, 인기 작가 = 인기/최근에서 중복 없이 추출
  const hero = visibleHot[0] ?? null
  const popularAuthors = useMemo(() => {
    const seen = new Set<number>()
    return [...visibleHot, ...visibleRecent]
      .filter(p => (seen.has(p.authorId) ? false : (seen.add(p.authorId), true)))
      .slice(0, 6)
      .map(p => ({
        id: p.authorId,
        nickname: p.authorNickname,
        profileImageUrl: p.authorProfileImageUrl,
        gradient: gradientOf(p.authorId),
      }))
  }, [visibleHot, visibleRecent])

  const activeShown = active.slice(0, 3)

  return (
    <div className="pb-20" style={{ background: 'var(--color-background)' }}>
      <div className="max-w-[1200px] mx-auto px-8 pt-8 space-y-16">

        {/* ── 진행 중인 커미션 (로그인 + 진행 중 거래 있을 때만) ── */}
        {isLoggedIn && active.length > 0 && (
          <section aria-label="진행 중인 커미션">
            <div className="rounded-2xl border p-5"
              style={{ borderColor: 'var(--color-outline)', background: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl" style={{ color: 'var(--color-primary)' }}>handshake</span>
                  진행 중인 커미션 <span style={{ color: 'var(--color-primary)' }}>{active.length}건</span>
                </h2>
                <Link to="/commission?tab=mine" className="text-xs font-bold hover:underline"
                  style={{ color: 'var(--color-primary)' }}>
                  내 커미션 전체 →
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {activeShown.map(c => (
                  <Link key={c.commissionId} to={`/commission/${c.commissionId}`}
                    className="rounded-xl border p-4 transition-colors hover:bg-surface-container-low"
                    style={{ borderColor: 'var(--color-outline)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          color: c.status === 'REVIEW' ? 'var(--color-secondary)' : 'var(--color-primary)',
                          background: c.status === 'REVIEW'
                            ? 'color-mix(in srgb, var(--color-secondary) 10%, transparent)'
                            : 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                        }}>
                        {COMMISSION_STATUS_LABEL[c.status] ?? c.status}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center"
                          style={{ background: 'var(--color-error)', color: 'var(--color-on-primary)' }}>
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold line-clamp-1">{c.title ?? '커미션 거래'}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {c.role === 'client' ? '작가' : '의뢰자'}: @{(c.role === 'client' ? c.artistNickname : c.clientNickname) ?? '알 수 없음'}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 히어로: 인기 1위 작품 ── */}
        <section aria-label="추천 작품">
          {showSkeleton ? (
            <SkeletonCard className="h-80 rounded-2xl" />
          ) : !hero ? (
            <div className="h-80 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--color-surface-container)' }}>
              <p style={{ color: 'var(--color-on-surface-variant)' }}>아직 인기 작품이 없습니다.</p>
            </div>
          ) : (
            <div className="relative h-80 rounded-2xl overflow-hidden"
              style={{ background: hero.thumbnailUrl ? undefined : gradientOf(hero.postId) }}>
              {hero.thumbnailUrl && (
                <img src={hero.thumbnailUrl} alt={hero.title}
                  className="w-full h-full object-cover"
                  style={{ imageRendering: 'pixelated' }} />
              )}
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }} />
              <div className="absolute bottom-8 left-8 right-8">
                <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold mb-3"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                  이번 주 인기 작품
                </span>
                <h1 className="text-3xl font-bold tracking-tight mb-1 text-white">{hero.title}</h1>
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    by @{hero.authorNickname} · ♥ {hero.likeCount.toLocaleString()}
                  </p>
                  <Link to={`/gallery/${hero.postId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                    작품 보기
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── 최근 작품 ── */}
        <section aria-label="최근 작품">
          <SectionHeader eyebrow="Gallery" title="최근 작품" to="/gallery/free" linkLabel="갤러리 전체 보기" />
          <div className="grid grid-cols-3 gap-4">
            {showSkeleton
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="aspect-square" />)
              : visibleRecent.length === 0
              ? <p className="col-span-3 text-center text-sm py-12" style={{ color: 'var(--color-on-surface-variant)' }}>아직 등록된 작품이 없습니다.</p>
              : visibleRecent.map(item => (
                  <Link key={item.postId} to={`/gallery/${item.postId}`}
                    className="aspect-square rounded-lg overflow-hidden relative group"
                    style={{ background: item.thumbnailUrl ? undefined : gradientOf(item.postId) }}>
                    {item.thumbnailUrl && (
                      <img src={item.thumbnailUrl} alt={item.title}
                        className="w-full h-full object-cover"
                        style={{ imageRendering: 'pixelated' }} />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                      <span className="text-white font-bold text-sm text-center line-clamp-2">{item.title}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>by {item.authorNickname}</span>
                    </div>
                  </Link>
                ))
            }
          </div>
        </section>

        {/* ── 신규 에셋 ── */}
        {(showSkeleton || visibleAssets.length > 0) && (
          <section aria-label="신규 에셋">
            <SectionHeader eyebrow="Asset Store" title="신규 에셋" to="/assets" linkLabel="에셋 스토어" />
            <div className="grid grid-cols-4 gap-4">
              {showSkeleton
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="aspect-[4/3]" />)
                : visibleAssets.map(a => (
                    <Link key={a.assetId} to={`/assets/${a.assetId}`} className="group">
                      <div className="aspect-[4/3] rounded-lg overflow-hidden mb-2 checkerboard">
                        {a.thumbnailUrl && (
                          <img src={a.thumbnailUrl} alt={a.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            style={{ imageRendering: 'pixelated' }} />
                        )}
                      </div>
                      <p className="text-sm font-bold line-clamp-1">{a.title}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>by {a.authorNickname}</span>
                        <span className="text-xs font-bold"
                          style={{ color: a.isFree ? 'var(--color-success)' : 'var(--color-accent)' }}>
                          {a.isFree ? '무료' : `₩${a.price.toLocaleString()}`}
                        </span>
                      </div>
                    </Link>
                  ))
              }
            </div>
          </section>
        )}

        {/* ── 모집 중 커미션 ── */}
        {(showSkeleton || visibleServices.length > 0) && (
          <section aria-label="모집 중 커미션">
            <SectionHeader eyebrow="Commission" title="모집 중인 작가 서비스" to="/commission" linkLabel="커미션 둘러보기" />
            <div className="grid grid-cols-4 gap-4">
              {showSkeleton
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-36" />)
                : visibleServices.map(s => (
                    <Link key={s.serviceId} to={`/artist-services/${s.serviceId}`}
                      className="rounded-xl border p-4 flex flex-col gap-2 transition-colors hover:bg-surface-container-low"
                      style={{ borderColor: 'var(--color-outline)', background: 'var(--color-surface)' }}>
                      <div className="flex items-center gap-2">
                        {s.artistProfileImageUrl ? (
                          <img src={s.artistProfileImageUrl} alt={s.artistNickname ?? '작가'}
                            className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full shrink-0" style={{ background: gradientOf(s.artistId) }} />
                        )}
                        <span className="text-xs font-bold truncate">{s.artistNickname ?? '작가'}</span>
                      </div>
                      <p className="text-sm font-bold line-clamp-2 flex-1">{s.title}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--color-on-surface-variant)' }}>{s.category}</span>
                        <span className="font-bold" style={{ color: 'var(--color-accent)' }}>{formatServicePrice(s)}</span>
                      </div>
                    </Link>
                  ))
              }
            </div>
          </section>
        )}

        {/* ── 인기 작가 ── */}
        {(showSkeleton || popularAuthors.length > 0) && (
          <section aria-label="인기 작가">
            <h2 className="text-2xl font-bold tracking-tight mb-6">인기 작가</h2>
            <div className="flex gap-6 flex-wrap">
              {showSkeleton
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
                      <div className="h-3 w-14 rounded animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
                    </div>
                  ))
                : popularAuthors.map(author => (
                    <Link key={author.id} to={`/profile/${author.nickname}`}
                      className="flex flex-col items-center gap-2 group">
                      {author.profileImageUrl ? (
                        <img src={author.profileImageUrl} alt={author.nickname}
                          className="w-16 h-16 rounded-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="w-16 h-16 rounded-full transition-transform group-hover:scale-105"
                          style={{ background: author.gradient }} />
                      )}
                      <span className="text-xs font-bold group-hover:text-[var(--color-primary)] transition-colors">
                        {author.nickname}
                      </span>
                    </Link>
                  ))
              }
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
