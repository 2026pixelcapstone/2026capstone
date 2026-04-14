import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { userApi, type UserProfileResponse } from '../api/userApi'
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
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0d1117' }}>
        <div className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent" style={{ borderColor: '#2f81f7' }} />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: '#0d1117', color: '#e6edf3' }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: '#30363d' }}>person_off</span>
        <p style={{ color: '#7d8590' }}>존재하지 않는 사용자입니다.</p>
        <Link to="/" className="text-sm font-bold" style={{ color: '#2f81f7' }}>메인으로 돌아가기</Link>
      </div>
    )
  }

  const isMyProfile = me?.userId === profile.userId

  return (
    <div className="min-h-screen" style={{ background: '#0d1117', color: '#e6edf3' }}>

      {/* 커버 배너 */}
      <div className="relative h-44 overflow-hidden"
        style={{ background: 'linear-gradient(90deg,#2f81f7cc,#2f81f7,#818cf8)' }}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: [
            'repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,0.2) 20px,rgba(255,255,255,0.2) 21px)',
            'repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(255,255,255,0.2) 20px,rgba(255,255,255,0.2) 21px)',
          ].join(','),
        }} />
      </div>

      {/* 프로필 인포 바 */}
      <div className="border-b" style={{ background: '#161b22', borderColor: '#30363d' }}>
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 pt-2" style={{ marginTop: -32 }}>
            {/* 아바타 + 이름 */}
            <div className="flex items-end gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl border-4 shadow-xl overflow-hidden"
                  style={{ borderColor: '#0d1117' }}>
                  {profile.profileImageUrl
                    ? <img src={profile.profileImageUrl} alt={profile.nickname} className="w-full h-full object-cover" />
                    : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-2xl"
                        style={{ background: 'linear-gradient(135deg,#2f81f7,#6366f1)', color: '#fff' }}>
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
                    style={{ background: 'rgba(47,129,247,0.1)', color: '#2f81f7' }}>{profile.role}</span>
                </div>
                <p className="text-xs" style={{ color: '#7d8590' }}>
                  가입 {new Date(profile.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 sm:mb-1">
              {isMyProfile ? (
                <Link to="/mypage"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:bg-[#292f38]"
                  style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }}>
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
                      ? { background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }
                      : { background: '#2f81f7', color: '#fff' }}>
                    <span className="material-symbols-outlined text-base">
                      {followed ? 'person_check' : 'person_add'}
                    </span>
                    {followLoading ? '처리 중...' : followed ? '팔로잉' : '팔로우'}
                  </button>
                  <button className="p-2 rounded-xl transition-all hover:bg-[#1c2128]"
                    style={{ border: '1px solid #30363d' }}>
                    <span className="material-symbols-outlined text-base" style={{ color: '#7d8590' }}>more_horiz</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 바이오 */}
          {(profile.bio || profile.websiteUrl) && (
            <div className="pb-4 max-w-2xl">
              {profile.bio && (
                <p className="text-sm leading-relaxed" style={{ color: '#7d8590' }}>{profile.bio}</p>
              )}
              {profile.websiteUrl && (
                <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: '#7d8590' }}>
                  <span className="material-symbols-outlined text-xs">link</span>
                  <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="hover:underline" style={{ color: '#2f81f7' }}>{profile.websiteUrl}</a>
                </div>
              )}
            </div>
          )}

          {/* 통계 */}
          <div className="flex flex-wrap gap-6 py-3 border-t text-sm" style={{ borderColor: '#30363d' }}>
            {[
              [profile.followerCount.toLocaleString(), '팔로워'],
              [profile.followingCount.toLocaleString(), '팔로잉'],
            ].map(([val, label]) => (
              <div key={label}>
                <span className="font-bold">{val}</span>
                <span className="ml-1" style={{ color: '#7d8590' }}>{label}</span>
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
                ? { background: 'rgba(47,129,247,0.12)', color: '#2f81f7' }
                : { color: '#7d8590' }}>
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
                  ? { background: 'rgba(47,129,247,0.15)', color: '#2f81f7' }
                  : { background: '#21262d', color: '#7d8590' }}>
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
                      ? { background: 'rgba(47,129,247,0.15)', color: '#2f81f7' }
                      : { background: '#21262d', color: '#7d8590' }}>
                    {s === 'recent' ? '최신순' : '인기순'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 탭별 콘텐츠 — 현재는 빈 상태 안내 (갤러리 유저별 필터 API 추가 시 교체) */}
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>
              {TABS.find(t => t.key === tab)?.icon}
            </span>
            <p className="text-sm" style={{ color: '#7d8590' }}>
              {tab === 'works' && `${profile.nickname}님의 작품`}
              {tab === 'assets' && `${profile.nickname}님의 에셋`}
              {tab === 'liked' && '좋아요한 작품'}
              {tab === 'following' && '팔로잉 목록'}
              {tab === 'followers' && '팔로워 목록'}
            </p>
            <p className="text-xs" style={{ color: '#484f58' }}>준비 중입니다.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
