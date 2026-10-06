import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'
import { assetApi, type AssetSummary } from '../api/assetApi'
import { artistServiceApi, type ArtistServiceSummary } from '../api/commissionApi'
import { paletteApi, type PaletteSummary } from '../api/paletteApi'
import { userApi, type PopularUser, type UserProfileResponse } from '../api/userApi'
import { editorApi, type ProjectSummary } from '../api/editorApi'
import { useBlockStore } from '../store/blockStore'
import { useAuthStore } from '../store/authStore'
import { useActiveCommissions } from '../hooks/useActiveCommissions'
import { useEmailGate } from '../hooks/useEmailGate'
import MainLeftRail from '../components/main/MainLeftRail'
import MainRightRail from '../components/main/MainRightRail'
import { SectionHeader, SkeletonCard, WorkTile, gradientOf } from '../components/main/MainShared'

function formatServicePrice(s: ArtistServiceSummary) {
  if (s.serviceType === 'OPTION' && s.basePrice != null) return `₩${s.basePrice.toLocaleString()} ~`
  if (s.priceMin != null && s.priceMax != null) return `₩${s.priceMin.toLocaleString()} ~ ₩${s.priceMax.toLocaleString()}`
  if (s.priceMin != null) return `₩${s.priceMin.toLocaleString()} ~`
  if (s.priceMax != null) return `~ ₩${s.priceMax.toLocaleString()}`
  return '가격 협의'
}

/** 자유·전용 최신 작품을 합쳐 최신순 n개 */
function mergeRecent(a: GalleryPostSummary[], b: GalleryPostSummary[], n: number) {
  return [...a, ...b]
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt) || y.postId - x.postId)
    .slice(0, n)
}

/**
 * 메인(5-A) — 넓은 화면 3단: 왼쪽 '나'(1440px+) · 가운데 피드 · 오른쪽 '커뮤니티'(1024px+).
 * 1024~1439px은 왼쪽 레일을 가운데 맨 위로, 그보다 좁으면 1단(오른쪽 레일은 피드 아래).
 * 공개 데이터는 한 번에 병렬(allSettled, 실패한 섹션만 비움), 개인 데이터는 로그인 사용자 기준.
 */
export default function MainPage() {
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuthStore()
  const uid = isLoggedIn ? user?.userId : undefined
  const { blockedUserIds, blockedTags, loaded: blocksLoaded } = useBlockStore()
  const { active } = useActiveCommissions()
  const { guard, gateProps } = useEmailGate()

  // ── 공개 데이터 ──
  const [trending, setTrending] = useState<GalleryPostSummary[]>([])
  const [recent, setRecent] = useState<GalleryPostSummary[]>([])
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [services, setServices] = useState<ArtistServiceSummary[]>([])
  const [palettes, setPalettes] = useState<PaletteSummary[]>([])
  const [artists, setArtists] = useState<PopularUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      galleryApi.getTrending({ days: 7, size: 9 }),
      galleryApi.getList({ type: 'FREE', page: 0, size: 6, sort: 'createdAt,desc' }),
      galleryApi.getList({ type: 'DEDICATED', page: 0, size: 6, sort: 'createdAt,desc' }),
      assetApi.getList({ page: 0, size: 4, sort: 'createdAt,desc' }),
      artistServiceApi.getOpenList({ page: 0, size: 4, sort: 'createdAt,desc' }),
      paletteApi.search({ sort: 'popular', size: 3 }),
      userApi.getPopular({ days: 7, size: 6 }),
    ]).then(([tr, rf, rd, as, sv, pl, ar]) => {
      if (tr.status === 'fulfilled') setTrending(tr.value.data.data)
      setRecent(mergeRecent(
        rf.status === 'fulfilled' ? rf.value.data.data.content : [],
        rd.status === 'fulfilled' ? rd.value.data.data.content : [], 6))
      if (as.status === 'fulfilled') setAssets(as.value.data.data.content)
      if (sv.status === 'fulfilled') setServices(sv.value.data.data.content)
      if (pl.status === 'fulfilled') setPalettes(pl.value.data.data.content)
      if (ar.status === 'fulfilled') setArtists(ar.value.data.data)
    }).finally(() => setLoading(false))
  }, [])

  // ── 개인 데이터(로그인 사용자 기준) ──
  const [me, setMe] = useState<UserProfileResponse | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [following, setFollowing] = useState<GalleryPostSummary[]>([])
  const [followingLoaded, setFollowingLoaded] = useState(false)

  // 사용자가 바뀌면(로그아웃·계정 전환) 렌더 중에 바로 비움 — 이전 사용자 데이터가 한 프레임도 안 보이게
  const [owner, setOwner] = useState(uid)
  if (owner !== uid) {
    setOwner(uid)
    setMe(null); setProjects([]); setFollowing([]); setFollowingLoaded(false)
  }

  useEffect(() => {
    if (!uid) return
    let alive = true   // 응답이 오기 전에 사용자가 바뀌면 버림
    Promise.allSettled([
      userApi.getMe(),
      editorApi.getProjects({ size: 3 }),
      galleryApi.getFollowingFeed({ size: 8 }),
    ]).then(([m, pj, fw]) => {
      if (!alive) return
      if (m.status === 'fulfilled') setMe(m.value.data.data)
      if (pj.status === 'fulfilled') setProjects(pj.value.data.data.content)
      if (fw.status === 'fulfilled') setFollowing(fw.value.data.data.content)
      setFollowingLoaded(true)
    })
    return () => { alive = false }
  }, [uid])

  // ── 차단 필터(로그인 + 차단 목록 로드 완료 시에만) ──
  const blockActive = isLoggedIn && blocksLoaded
  const notBlockedPost = useCallback((p: GalleryPostSummary) =>
    !blockActive || (!blockedUserIds.includes(p.authorId) && !p.tags?.some(t => blockedTags.includes(t))),
  [blockActive, blockedUserIds, blockedTags])
  const notBlockedUser = useCallback((id: number | null | undefined) =>
    !blockActive || id == null || !blockedUserIds.includes(id), [blockActive, blockedUserIds])

  const visibleTrending = useMemo(() => trending.filter(notBlockedPost), [trending, notBlockedPost])
  const visibleRecent = useMemo(() => recent.filter(notBlockedPost), [recent, notBlockedPost])
  const visibleFollowing = useMemo(() => following.filter(notBlockedPost), [following, notBlockedPost])
  const visibleAssets = useMemo(() => assets.filter(a =>
    notBlockedUser(a.authorId) && !(blockActive && a.tags?.some(t => blockedTags.includes(t)))), [assets, notBlockedUser, blockActive, blockedTags])
  const visibleServices = useMemo(() => services.filter(s => notBlockedUser(s.artistId)), [services, notBlockedUser])
  const visiblePalettes = useMemo(() => palettes.filter(p => notBlockedUser(p.authorId)), [palettes, notBlockedUser])
  const visibleArtists = useMemo(() => artists.filter(a => notBlockedUser(a.userId)), [artists, notBlockedUser])

  // 로그인 사용자는 차단 목록 로드 완료까지 스켈레톤(차단 항목 깜빡임 방지)
  const showSkeleton = loading || (isLoggedIn && !blocksLoaded)
  const hero = visibleTrending[0] ?? null
  const trendingRest = visibleTrending.slice(1, 9)

  const leftRailProps = { isLoggedIn, me, projects, active }

  return (
    <div className="pb-20" style={{ background: 'var(--color-background)' }}>
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] wide:grid-cols-[240px_minmax(0,1fr)_280px]">

          {/* 왼쪽 '나' 레일(1440px 이상) — 따라 내려오고, 길면 레일만 스크롤 */}
          <aside className="hidden wide:block" aria-label="내 활동">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              <MainLeftRail variant="rail" {...leftRailProps} />
            </div>
          </aside>

          {/* 가운데 피드 */}
          <div className="min-w-0 space-y-12">
            {/* 1440px 미만: 왼쪽 레일 내용을 맨 위로 */}
            <div className="wide:hidden">
              <MainLeftRail variant="inline" {...leftRailProps} />
            </div>

            {/* 히어로: 소개 + 이번 주 인기 1위 */}
            <section aria-label="소개와 이번 주 인기 작품" className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-stretch">
              <div className="flex flex-col justify-center py-4">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">픽셀아트 플랫폼</h1>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                  픽셀아트를 그리고, 공유하고, 에셋과 커미션으로 거래하는 곳입니다.
                </p>
                <div className="flex flex-wrap gap-2 mt-5">
                  <button type="button" {...gateProps}
                    onClick={guard(() => navigate(isLoggedIn ? '/editor' : '/login', isLoggedIn ? undefined : { state: { from: '/editor' } }))}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                    <span className="material-symbols-outlined text-base">brush</span>그리기 시작
                  </button>
                  <Link to="/gallery/free" className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm"
                    style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                    둘러보기
                  </Link>
                </div>
              </div>

              {showSkeleton ? <SkeletonCard className="h-72 rounded-2xl" /> : !hero ? (
                <div className="h-72 rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-surface-container)' }}>
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>아직 인기 작품이 없습니다.</p>
                </div>
              ) : (
                <Link to={`/gallery/${hero.postId}`} className="relative h-72 rounded-2xl overflow-hidden block group"
                  style={{ background: hero.thumbnailUrl ? undefined : gradientOf(hero.postId) }}>
                  {hero.thumbnailUrl && <img src={hero.thumbnailUrl} alt={hero.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />
                  <div className="absolute bottom-5 left-5 right-5">
                    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold mb-2" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                      이번 주 인기 작품
                    </span>
                    <p className="text-2xl font-bold text-white line-clamp-1">{hero.title}</p>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>by @{hero.authorNickname} · ♥ {hero.likeCount.toLocaleString()}</p>
                  </div>
                </Link>
              )}
            </section>

            {/* 팔로우한 작가의 새 작품(로그인) */}
            {isLoggedIn && followingLoaded && (
              <section aria-label="팔로우한 작가의 새 작품">
                <SectionHeader eyebrow="Following" title="팔로우한 작가의 새 작품" />
                {visibleFollowing.length === 0 ? (
                  <div className="rounded-xl border p-5 text-sm flex flex-wrap items-center justify-between gap-3"
                    style={{ borderColor: 'var(--color-outline)', background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                    마음에 드는 작가를 팔로우하면 새 작품이 여기에 모여요.
                    <Link to="/gallery/free" className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>작가 찾아보기 →</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {visibleFollowing.map(p => <WorkTile key={p.postId} post={p} />)}
                  </div>
                )}
              </section>
            )}

            {/* 이번 주 인기 */}
            {(showSkeleton || trendingRest.length > 0) && (
              <section aria-label="이번 주 인기 작품">
                <SectionHeader eyebrow="Trending" title="이번 주 인기" to="/gallery/free" linkLabel="갤러리" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {showSkeleton
                    ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} className="aspect-square" />)
                    : trendingRest.map(p => <WorkTile key={p.postId} post={p} />)}
                </div>
              </section>
            )}

            {/* 최근 작품(자유·전용 합침) */}
            <section aria-label="최근 작품">
              <SectionHeader eyebrow="Gallery" title="최근 작품" to="/gallery/free" linkLabel="갤러리 전체 보기" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {showSkeleton
                  ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="aspect-square" />)
                  : visibleRecent.length === 0
                    ? <p className="col-span-full text-center text-sm py-12" style={{ color: 'var(--color-on-surface-variant)' }}>아직 등록된 작품이 없습니다.</p>
                    : visibleRecent.map(p => <WorkTile key={p.postId} post={p} />)}
              </div>
            </section>

            {/* 신규 에셋 */}
            {(showSkeleton || visibleAssets.length > 0) && (
              <section aria-label="신규 에셋">
                <SectionHeader eyebrow="Asset Store" title="신규 에셋" to="/assets" linkLabel="에셋 스토어" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {showSkeleton
                    ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="aspect-[4/3]" />)
                    : visibleAssets.map(a => (
                        <Link key={a.assetId} to={`/assets/${a.assetId}`} className="group">
                          <div className="aspect-[4/3] rounded-lg overflow-hidden mb-2 checkerboard">
                            {a.thumbnailUrl && (
                              <img src={a.thumbnailUrl} alt={a.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" style={{ imageRendering: 'pixelated' }} />
                            )}
                          </div>
                          <p className="text-sm font-bold line-clamp-1">{a.title}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs truncate" style={{ color: 'var(--color-on-surface-variant)' }}>by {a.authorNickname}</span>
                            <span className="text-xs font-bold shrink-0" style={{ color: a.isFree ? 'var(--color-success)' : 'var(--color-accent)' }}>
                              {a.isFree ? '무료' : `₩${a.price.toLocaleString()}`}
                            </span>
                          </div>
                        </Link>
                      ))}
                </div>
              </section>
            )}

            {/* 모집 중 커미션 */}
            {(showSkeleton || visibleServices.length > 0) && (
              <section aria-label="모집 중 커미션">
                <SectionHeader eyebrow="Commission" title="모집 중인 작가 서비스" to="/commission" linkLabel="커미션 둘러보기" />
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {showSkeleton
                    ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-36" />)
                    : visibleServices.map(s => (
                        <Link key={s.serviceId} to={`/artist-services/${s.serviceId}`}
                          className="rounded-xl border p-4 flex flex-col gap-2 transition-colors hover:bg-surface-container-low"
                          style={{ borderColor: 'var(--color-outline)', background: 'var(--color-surface)' }}>
                          <div className="flex items-center gap-2">
                            {s.artistProfileImageUrl
                              ? <img src={s.artistProfileImageUrl} alt={s.artistNickname ?? '작가'} className="w-7 h-7 rounded-full object-cover shrink-0" />
                              : <div className="w-7 h-7 rounded-full shrink-0" style={{ background: gradientOf(s.artistId) }} />}
                            <span className="text-xs font-bold truncate">{s.artistNickname ?? '작가'}</span>
                          </div>
                          <p className="text-sm font-bold line-clamp-2 flex-1">{s.title}</p>
                          <div className="flex items-center justify-between text-xs">
                            <span style={{ color: 'var(--color-on-surface-variant)' }}>{s.category}</span>
                            <span className="font-bold" style={{ color: 'var(--color-accent)' }}>{formatServicePrice(s)}</span>
                          </div>
                        </Link>
                      ))}
                </div>
              </section>
            )}
          </div>

          {/* 오른쪽 '커뮤니티' 레일(1024px 이상은 따라 내려옴, 그 아래는 피드 아래로) */}
          <aside aria-label="커뮤니티">
            <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
              <MainRightRail palettes={visiblePalettes} artists={visibleArtists} loading={showSkeleton} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
