import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { userApi, type UserProfileResponse } from '../api/userApi'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'
import { assetApi, type AssetSummary } from '../api/assetApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'

const TABS = [
  { key: 'works',     label: '작품',   icon: 'palette' },
  { key: 'assets',    label: '에셋',   icon: 'sell' },
  { key: 'liked',     label: '좋아요', icon: 'favorite' },
  { key: 'following', label: '팔로잉', icon: 'person' },
  { key: 'followers', label: '팔로워', icon: 'group' },
]

function EmptyTab({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>{icon}</span>
      <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{text}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { isLoggedIn, user: me } = useAuthStore()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState('works')
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const [followed, setFollowed] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  // 탭 콘텐츠
  const [works, setWorks] = useState<GalleryPostSummary[]>([])
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [liked, setLiked] = useState<GalleryPostSummary[]>([])
  const [following, setFollowing] = useState<UserProfileResponse[]>([])
  const [followers, setFollowers] = useState<UserProfileResponse[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  useEffect(() => {
    if (!username) return
    setLoading(true)
    setNotFound(false)
    userApi.getUserByNickname(username)
      .then(res => {
        const data = res.data.data
        setProfile(data)
        setFollowed(data.isFollowing)
      })
      .catch((err) => {
        const status = getErrorStatus(err)
        if (status === 403) navigate('/403', { replace: true })
        else if (status && status >= 500) navigate('/500', { replace: true })
        else setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [username])

  const uid = profile?.userId

  // 프로필(유저)이 바뀌면 탭 상태 초기화
  useEffect(() => {
    setTab('works')
    setWorks([]); setAssets([]); setLiked([]); setFollowing([]); setFollowers([])
  }, [uid])

  // 활성 탭 데이터 로드 — uid만 의존(팔로우/언팔로우로 profile 객체가 새로 만들어져도 재요청 안 함)
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    setTabLoading(true)

    const run = async () => {
      try {
        if (tab === 'works') {
          const sortParam = sort === 'popular' ? 'likeCount,desc' : 'createdAt,desc'
          const res = await galleryApi.getList({ authorId: uid, size: 24, sort: sortParam })
          if (!cancelled) setWorks(res.data.data.content)
        } else if (tab === 'assets') {
          const res = await assetApi.getList({ authorId: uid, size: 24, sort: 'createdAt,desc' })
          if (!cancelled) setAssets(res.data.data.content)
        } else if (tab === 'liked') {
          const res = await galleryApi.getList({ likedBy: uid, size: 24, sort: 'createdAt,desc' })
          if (!cancelled) setLiked(res.data.data.content)
        } else if (tab === 'following') {
          const res = await userApi.getFollowing(uid)
          if (!cancelled) setFollowing(res.data.data)
        } else if (tab === 'followers') {
          const res = await userApi.getFollowers(uid)
          if (!cancelled) setFollowers(res.data.data)
        }
      } catch {
        // 탭 로드 실패 시 빈 상태 유지
      } finally {
        if (!cancelled) setTabLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [uid, tab, sort])

  const handleFollow = async () => {
    if (!isLoggedIn || !profile) return
    setFollowLoading(true)
    try {
      if (followed) {
        await userApi.unfollow(profile.userId)
        setFollowed(false)
        setProfile(prev => prev ? { ...prev, followerCount: prev.followerCount - 1 } : prev)
      } else {
        await userApi.follow(profile.userId)
        setFollowed(true)
        setProfile(prev => prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev)
      }
    } catch (err) {
      toast.error(getErrorMessage(err, '팔로우 처리에 실패했습니다.'))
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-background)' }}>
        <div className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-outline)' }}>person_off</span>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>존재하지 않는 사용자입니다.</p>
        <Link to="/" className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>메인으로 돌아가기</Link>
      </div>
    )
  }

  const isMyProfile = me?.userId === profile.userId

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>

      {/* 커버 배너 */}
      <div className="relative h-44 overflow-hidden"
        style={{ background: 'linear-gradient(90deg,color-mix(in srgb, var(--color-primary) 80%, transparent),var(--color-primary),var(--color-secondary))' }}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: [
            'repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,0.2) 20px,rgba(255,255,255,0.2) 21px)',
            'repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(255,255,255,0.2) 20px,rgba(255,255,255,0.2) 21px)',
          ].join(','),
        }} />
      </div>

      {/* 프로필 인포 바 */}
      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 pt-2" style={{ marginTop: -32 }}>
            {/* 아바타 + 이름 */}
            <div className="flex items-end gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl border-4 shadow-xl overflow-hidden"
                  style={{ borderColor: 'var(--color-background)' }}>
                  {profile.profileImageUrl
                    ? <img src={profile.profileImageUrl} alt={profile.nickname} className="w-full h-full object-cover" />
                    : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-2xl"
                        style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))', color: '#fff' }}>
                        {profile.nickname.slice(0, 2).toUpperCase()}
                      </div>
                    )
                  }
                </div>
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h1 className="text-xl font-bold">{profile.nickname}</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}>{profile.role}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  가입 {new Date(profile.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 sm:mb-1">
              {isMyProfile ? (
                <Link to="/mypage"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:bg-surface-container-high"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                  <span className="material-symbols-outlined text-base">edit</span>
                  프로필 편집
                </Link>
              ) : (
                <>
                  <button
                    onClick={handleFollow}
                    disabled={!isLoggedIn || followLoading}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                    style={followed
                      ? { background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }
                      : { background: 'var(--color-primary)', color: '#fff' }}>
                    <span className="material-symbols-outlined text-base">
                      {followed ? 'person_check' : 'person_add'}
                    </span>
                    {followLoading ? '처리 중...' : followed ? '팔로잉' : '팔로우'}
                  </button>
                  <button className="p-2 rounded-xl transition-all hover:bg-surface-container-low"
                    style={{ border: '1px solid var(--color-outline)' }}>
                    <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-on-surface-variant)' }}>more_horiz</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 바이오 */}
          {(profile.bio || profile.websiteUrl) && (
            <div className="pb-4 max-w-2xl">
              {profile.bio && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{profile.bio}</p>
              )}
              {profile.websiteUrl && (
                <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-xs">link</span>
                  <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="hover:underline" style={{ color: 'var(--color-primary)' }}>{profile.websiteUrl}</a>
                </div>
              )}
            </div>
          )}

          {/* 통계 */}
          <div className="flex flex-wrap gap-6 py-3 border-t text-sm" style={{ borderColor: 'var(--color-outline)' }}>
            {[
              [profile.followerCount.toLocaleString(), '팔로워'],
              [profile.followingCount.toLocaleString(), '팔로잉'],
            ].map(([val, label]) => (
              <div key={label}>
                <span className="font-bold">{val}</span>
                <span className="ml-1" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 탭 + 콘텐츠 */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 flex gap-6 items-start">

        {/* 좌측 탭 사이드바 */}
        <nav className="hidden sm:flex flex-col flex-shrink-0 w-44 sticky top-24 gap-0.5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-left transition-all"
              style={tab === t.key
                ? { background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }
                : { color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined text-base flex-shrink-0"
                style={{ fontVariationSettings: tab === t.key ? "'FILL' 1" : "'FILL' 0" }}>
                {t.icon}
              </span>
              <span className="flex-1">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* 콘텐츠 */}
        <div className="flex-1 min-w-0">
          {/* 모바일 탭 */}
          <div className="flex sm:hidden overflow-x-auto no-scrollbar gap-1 mb-4">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                style={tab === t.key
                  ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }
                  : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base">{TABS.find(t => t.key === tab)?.label}</h2>
            {tab === 'works' && (
              <div className="flex gap-1">
                {(['recent', 'popular'] as const).map(s => (
                  <button key={s} onClick={() => setSort(s)}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                    style={sort === s
                      ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }
                      : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                    {s === 'recent' ? '최신순' : '인기순'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 탭별 콘텐츠 */}
          {tabLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
              ))}
            </div>
          ) : (
            <>
              {/* 작품 */}
              {tab === 'works' && (
                works.length === 0 ? (
                  <EmptyTab icon="palette" text={`${profile.nickname}님의 작품이 없습니다.`} />
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {works.map(w => (
                      <Link key={w.postId} to={`/gallery/${w.postId}`}
                        className="group aspect-square rounded-xl overflow-hidden relative" style={{ background: 'var(--color-surface-container)' }}>
                        {w.thumbnailUrl
                          ? <img src={w.thumbnailUrl} alt={w.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                          : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,var(--color-surface),var(--color-surface-container))' }} />}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                          <p className="text-xs font-bold text-white text-center line-clamp-2">{w.title}</p>
                          <div className="flex items-center gap-2 text-xs" style={{ color: '#ccc' }}>
                            <span>♥ {w.likeCount}</span><span>👁 {w.viewCount}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              )}

              {/* 에셋 */}
              {tab === 'assets' && (
                assets.length === 0 ? (
                  <EmptyTab icon="sell" text={`${profile.nickname}님의 에셋이 없습니다.`} />
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {assets.map(a => (
                      <Link key={a.assetId} to={`/assets/${a.assetId}`}
                        className="group rounded-xl overflow-hidden border transition-all hover:-translate-y-0.5 hover:border-primary"
                        style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                        <div className="aspect-square overflow-hidden">
                          {a.thumbnailUrl
                            ? <img src={a.thumbnailUrl} alt={a.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                            : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,var(--color-surface),var(--color-surface-container))' }} />}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-bold truncate">{a.title}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-bold" style={{ color: a.isFree ? 'var(--color-success)' : 'var(--color-primary)' }}>
                              {a.isFree ? '무료' : `₩${a.price.toLocaleString()}`}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>♥ {a.likeCount}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              )}

              {/* 좋아요 */}
              {tab === 'liked' && (
                liked.length === 0 ? (
                  <EmptyTab icon="favorite" text="좋아요한 작품이 없습니다." />
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {liked.map(w => (
                      <Link key={w.postId} to={`/gallery/${w.postId}`}
                        className="group aspect-square rounded-xl overflow-hidden relative" style={{ background: 'var(--color-surface-container)' }}>
                        {w.thumbnailUrl
                          ? <img src={w.thumbnailUrl} alt={w.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                          : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,var(--color-surface),var(--color-surface-container))' }} />}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                          <p className="text-xs font-bold text-white text-center line-clamp-2">{w.title}</p>
                          <p className="text-xs" style={{ color: '#ccc' }}>by {w.authorNickname}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              )}

              {/* 팔로잉 / 팔로워 */}
              {(tab === 'following' || tab === 'followers') && (
                (() => {
                  const users = tab === 'following' ? following : followers
                  return users.length === 0 ? (
                    <EmptyTab icon={tab === 'following' ? 'person' : 'group'}
                      text={tab === 'following' ? '팔로잉 중인 유저가 없습니다.' : '팔로워가 없습니다.'} />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {users.map(u => (
                        <Link key={u.userId} to={`/profile/${u.nickname}`}
                          className="rounded-xl border p-4 text-center hover:shadow-md hover:border-primary transition-all"
                          style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-2 overflow-hidden"
                            style={{ background: u.profileImageUrl ? undefined : 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))' }}>
                            {u.profileImageUrl
                              ? <img src={u.profileImageUrl} alt={u.nickname} className="w-full h-full object-cover" />
                              : u.nickname.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="font-bold text-sm truncate">{u.nickname}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                            팔로워 {u.followerCount.toLocaleString()}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )
                })()
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
