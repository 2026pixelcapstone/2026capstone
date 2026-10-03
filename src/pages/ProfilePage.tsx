import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { userApi, type UserProfileResponse } from '../api/userApi'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'
import { assetApi, type AssetSummary } from '../api/assetApi'
import { useAuthStore } from '../store/authStore'
import { useBlockStore } from '../store/blockStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'
import ProfileHeader from '../components/profile/ProfileHeader'
import { ProfileTabSidebar, ProfileTabMobile, SortToggle, type ProfileTab } from '../components/profile/ProfileTabs'
import { WorkCard, AssetCard, UserCard, EmptyTab, GridSkeleton, CardGrid } from '../components/profile/ProfileCards'

const TABS: ProfileTab[] = [
  { key: 'works',     label: '작품',   icon: 'palette' },
  { key: 'assets',    label: '에셋',   icon: 'sell' },
  { key: 'liked',     label: '좋아요', icon: 'favorite' },
  { key: 'following', label: '팔로잉', icon: 'person' },
  { key: 'followers', label: '팔로워', icon: 'group' },
]

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { isLoggedIn, user: me } = useAuthStore()
  const { isUserBlocked, blockUser, unblockUser, loaded: blocksLoaded } = useBlockStore()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState('works')
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const [followed, setFollowed] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)

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
        <div className="animate-spin rounded-full w-10 h-10 border-2" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
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

      <ProfileHeader
        profile={profile}
        subline={`가입 ${new Date(profile.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}`}
        actions={isMyProfile ? (
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
            {/* 차단 목록 로드 완료 후에만 노출 — 미로드 상태의 빈 blockedUserIds로 인한 오표시·중복 차단 방지 */}
            {isLoggedIn && blocksLoaded && (
              <button
                onClick={async () => {
                  if (blockLoading) return   // 진행 중 연타 → 병렬 호출로 상태 발산 방지
                  setBlockLoading(true)
                  try {
                    if (isUserBlocked(profile.userId)) {
                      await unblockUser(profile.userId)
                      toast.success('차단이 해제되었습니다.')
                    } else {
                      await blockUser(profile.userId)
                      toast.success('사용자를 차단했습니다. 마이페이지 > 차단 관리에서 확인하세요.')
                    }
                  } catch (err) {
                    toast.error(getErrorMessage(err, '처리에 실패했습니다.'))
                  } finally {
                    setBlockLoading(false)
                  }
                }}
                disabled={blockLoading}
                aria-label={isUserBlocked(profile.userId) ? '차단 해제' : '사용자 차단'}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={isUserBlocked(profile.userId)
                  ? { background: 'color-mix(in srgb, var(--color-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-error) 30%, transparent)', color: 'var(--color-error)' }
                  : { background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                {isUserBlocked(profile.userId) ? '차단됨' : '차단'}
              </button>
            )}
          </>
        )}
        stats={[
          { label: '팔로워', value: profile.followerCount.toLocaleString() },
          { label: '팔로잉', value: profile.followingCount.toLocaleString() },
        ]}
      />

      {/* 탭 + 콘텐츠 */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 flex gap-6 items-start">
        <ProfileTabSidebar tabs={TABS} active={tab} onChange={setTab} />

        {/* 콘텐츠 */}
        <div className="flex-1 min-w-0">
          <ProfileTabMobile tabs={TABS} active={tab} onChange={setTab} />

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base">{TABS.find(t => t.key === tab)?.label}</h2>
            {tab === 'works' && <SortToggle sort={sort} onChange={setSort} />}
          </div>

          {/* 탭별 콘텐츠 */}
          {tabLoading ? (
            <GridSkeleton variant={tab === 'following' || tab === 'followers' ? 'user' : 'square'} />
          ) : (
            <>
              {tab === 'works' && (
                works.length === 0
                  ? <EmptyTab icon="palette" text={`${profile.nickname}님의 작품이 없습니다.`} />
                  : <CardGrid variant="square">{works.map(w => <WorkCard key={w.postId} post={w} />)}</CardGrid>
              )}
              {tab === 'assets' && (
                assets.length === 0
                  ? <EmptyTab icon="sell" text={`${profile.nickname}님의 에셋이 없습니다.`} />
                  : <CardGrid variant="square">{assets.map(a => <AssetCard key={a.assetId} asset={a} />)}</CardGrid>
              )}
              {tab === 'liked' && (
                liked.length === 0
                  ? <EmptyTab icon="favorite" text="좋아요한 작품이 없습니다." />
                  : <CardGrid variant="square">{liked.map(w => <WorkCard key={w.postId} post={w} showAuthor />)}</CardGrid>
              )}
              {tab === 'following' && (
                following.length === 0
                  ? <EmptyTab icon="person" text="팔로잉 중인 유저가 없습니다." />
                  : <CardGrid variant="user">{following.map(u => <UserCard key={u.userId} user={u} />)}</CardGrid>
              )}
              {tab === 'followers' && (
                followers.length === 0
                  ? <EmptyTab icon="group" text="팔로워가 없습니다." />
                  : <CardGrid variant="user">{followers.map(u => <UserCard key={u.userId} user={u} />)}</CardGrid>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
