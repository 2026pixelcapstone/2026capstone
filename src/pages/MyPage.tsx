import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { userApi, type UserProfileResponse } from '../api/userApi'
import { editorApi, type ProjectSummary } from '../api/editorApi'

const TABS = [
  { key: 'works',      label: '작품',           icon: 'palette',  private: false },
  { key: 'assets',     label: '에셋',           icon: 'sell',     private: false },
  { key: 'liked',      label: '좋아요',         icon: 'favorite', private: false },
  { key: 'following',  label: '팔로잉',         icon: 'person',   private: false },
  { key: 'followers',  label: '팔로워',         icon: 'group',    private: false },
  { key: 'saved',      label: '저장된 프로젝트', icon: 'folder',   private: true  },
  { key: 'commission', label: '커미션',          icon: 'payments', private: true  },
]

interface FollowUser {
  userId: number
  nickname: string
  profileImageUrl: string | null
  bio: string | null
  followerCount: number
  followingCount: number
}

export default function MyPage() {
  const [tab, setTab]   = useState('works')
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [following, setFollowing] = useState<FollowUser[]>([])
  const [followers, setFollowers] = useState<FollowUser[]>([])
  const [socialLoading, setSocialLoading] = useState(false)

  useEffect(() => {
    userApi.getMe().then(res => setProfile(res.data.data)).catch(() => {})
    editorApi.getProjects({ size: 20 }).then(res => setProjects(res.data.data.content)).catch(() => {})
  }, [])

  // following/followers는 탭 진입 시 로드
  useEffect(() => {
    if (!profile) return
    if (tab === 'following' && following.length === 0) {
      setSocialLoading(true)
      userApi.getFollowing(profile.userId)
        .then(res => setFollowing(res.data.data as unknown as FollowUser[]))
        .catch(() => {})
        .finally(() => setSocialLoading(false))
    }
    if (tab === 'followers' && followers.length === 0) {
      setSocialLoading(true)
      userApi.getFollowers(profile.userId)
        .then(res => setFollowers(res.data.data as unknown as FollowUser[]))
        .catch(() => {})
        .finally(() => setSocialLoading(false))
    }
  }, [tab, profile])

  const tabCount: Record<string, string> = {
    works:      '—',
    assets:     '—',
    liked:      '—',
    following:  (profile?.followingCount ?? 0).toString(),
    followers:  (profile?.followerCount ?? 0).toString(),
    saved:      projects.length.toString(),
    commission: '—',
  }

  return (
    <div className="min-h-screen" style={{ background: '#0d1117', color: '#e6edf3' }}>

      {/* 커버 배너 */}
      <div className="relative h-44 overflow-hidden"
        style={{ background: 'linear-gradient(90deg,#2f81f7cc,#2f81f7,#6366f1)' }}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: [
            'repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,0.2) 20px,rgba(255,255,255,0.2) 21px)',
            'repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(255,255,255,0.2) 20px,rgba(255,255,255,0.2) 21px)',
          ].join(','),
        }} />
        <button className="absolute bottom-3 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-white/20"
          style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
          <span className="material-symbols-outlined text-sm">photo_camera</span>
          커버 변경
        </button>
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
                  {profile?.profileImageUrl
                    ? <img src={profile.profileImageUrl} alt={profile.nickname} className="w-full h-full object-cover" />
                    : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-2xl"
                        style={{ background: 'linear-gradient(135deg,#2f81f7,#6366f1)', color: '#fff' }}>
                        {profile?.nickname?.slice(0, 2).toUpperCase() ?? '..'}
                      </div>
                    )
                  }
                </div>
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h1 className="text-xl font-bold">{profile?.nickname ?? '...'}</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(47,129,247,0.1)', color: '#2f81f7' }}>
                    {profile?.role ?? 'USER'}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#7d8590' }}>
                  {profile?.email}
                  {profile?.createdAt && ` · 가입 ${new Date(profile.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}`}
                </p>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2 sm:mb-1">
              <Link to="/editor"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg,#2f81f7,#6366f1)', color: '#fff' }}>
                <span className="material-symbols-outlined text-base">add</span>
                새 작품
              </Link>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:bg-[#292f38]"
                style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }}>
                <span className="material-symbols-outlined text-base">edit</span>
                프로필 편집
              </button>
              <button className="p-2 rounded-xl transition-all hover:bg-[#1c2128]"
                style={{ border: '1px solid #30363d' }}>
                <span className="material-symbols-outlined text-base" style={{ color: '#7d8590' }}>settings</span>
              </button>
            </div>
          </div>

          {/* 바이오 */}
          {(profile?.bio || profile?.websiteUrl) && (
            <div className="pb-4 max-w-2xl">
              {profile?.bio && (
                <p className="text-sm leading-relaxed" style={{ color: '#7d8590' }}>{profile.bio}</p>
              )}
              {profile?.websiteUrl && (
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
              [(profile?.followerCount ?? 0).toLocaleString(), '팔로워'],
              [(profile?.followingCount ?? 0).toLocaleString(), '팔로잉'],
              [projects.length.toString(), '프로젝트'],
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
        <nav className="hidden sm:flex flex-col flex-shrink-0 w-44 sticky top-[4.5rem] gap-0.5">
          {TABS.map((t, i) => (
            <div key={t.key}>
              {t.private && !TABS[i - 1]?.private && (
                <div className="my-2 border-t" style={{ borderColor: '#21262d' }} />
              )}
              <button onClick={() => setTab(t.key)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-left transition-all"
                style={tab === t.key
                  ? { background: 'rgba(47,129,247,0.12)', color: '#2f81f7' }
                  : { color: '#7d8590' }}>
                <span className="material-symbols-outlined text-base flex-shrink-0"
                  style={{ fontVariationSettings: tab === t.key ? "'FILL' 1" : "'FILL' 0" }}>
                  {t.icon}
                </span>
                <span className="flex-1 flex items-center gap-1">
                  {t.label}
                  {t.private && (
                    <span className="material-symbols-outlined opacity-40" style={{ fontSize: 12 }}>lock</span>
                  )}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: tab === t.key ? 'rgba(47,129,247,0.15)' : '#21262d',
                    color: tab === t.key ? '#2f81f7' : '#484f58',
                  }}>
                  {tabCount[t.key]}
                </span>
              </button>
            </div>
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
            <h2 className="font-bold text-base">
              {TABS.find(t => t.key === tab)?.label}
              <span className="ml-2 text-sm font-normal" style={{ color: '#7d8590' }}>
                {tabCount[tab]}
              </span>
            </h2>
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
            {tab === 'saved' && (
              <Link to="/editor"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition-all"
                style={{ background: '#2f81f7', color: '#fff' }}>
                <span className="material-symbols-outlined text-base">add</span>
                새 프로젝트
              </Link>
            )}
          </div>

          {/* 준비 중 공통 컴포넌트 */}
          {(tab === 'works' || tab === 'assets' || tab === 'liked') && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>
                {TABS.find(t => t.key === tab)?.icon}
              </span>
              <p className="text-sm font-bold" style={{ color: '#7d8590' }}>
                {tab === 'works' && '갤러리 연동 준비 중'}
                {tab === 'assets' && '에셋 연동 준비 중'}
                {tab === 'liked' && '좋아요 연동 준비 중'}
              </p>
              <p className="text-xs" style={{ color: '#484f58' }}>유저별 필터 API 추가 후 연결될 예정입니다.</p>
            </div>
          )}

          {/* 팔로잉 */}
          {tab === 'following' && (
            socialLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-4 animate-pulse"
                    style={{ background: '#21262d', borderColor: '#30363d', height: 140 }} />
                ))}
              </div>
            ) : following.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>person</span>
                <p className="text-sm" style={{ color: '#7d8590' }}>팔로잉 중인 유저가 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {following.map(u => (
                  <Link key={u.userId} to={`/profile/${u.nickname}`}
                    className="rounded-xl border p-4 text-center hover:shadow-md hover:border-[#2f81f7] transition-all"
                    style={{ background: '#21262d', borderColor: '#30363d' }}>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-2 overflow-hidden"
                      style={{ background: u.profileImageUrl ? undefined : 'linear-gradient(135deg,#2f81f7,#6366f1)' }}>
                      {u.profileImageUrl
                        ? <img src={u.profileImageUrl} alt={u.nickname} className="w-full h-full object-cover" />
                        : u.nickname.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div className="font-bold text-sm">{u.nickname}</div>
                    <div className="text-xs mt-0.5 mb-2" style={{ color: '#7d8590' }}>
                      팔로워 {u.followerCount.toLocaleString()}
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(47,129,247,0.1)', border: '1px solid rgba(47,129,247,0.2)', color: '#2f81f7' }}>
                      팔로잉
                    </span>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* 팔로워 */}
          {tab === 'followers' && (
            socialLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-4 animate-pulse"
                    style={{ background: '#21262d', borderColor: '#30363d', height: 140 }} />
                ))}
              </div>
            ) : followers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>group</span>
                <p className="text-sm" style={{ color: '#7d8590' }}>팔로워가 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {followers.map(u => (
                  <Link key={u.userId} to={`/profile/${u.nickname}`}
                    className="rounded-xl border p-4 text-center hover:shadow-md hover:border-[#2f81f7] transition-all"
                    style={{ background: '#21262d', borderColor: '#30363d' }}>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-2 overflow-hidden"
                      style={{ background: u.profileImageUrl ? undefined : 'linear-gradient(135deg,#2f81f7,#6366f1)' }}>
                      {u.profileImageUrl
                        ? <img src={u.profileImageUrl} alt={u.nickname} className="w-full h-full object-cover" />
                        : u.nickname.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div className="font-bold text-sm">{u.nickname}</div>
                    <div className="text-xs mt-0.5 mb-2" style={{ color: '#7d8590' }}>
                      팔로워 {u.followerCount.toLocaleString()}
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: '#1c2128', border: '1px solid #30363d', color: '#7d8590' }}>
                      팔로우
                    </span>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* 저장된 프로젝트 */}
          {tab === 'saved' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {projects.map(p => (
                <Link key={p.projectId} to={`/editor?projectId=${p.projectId}`}
                  className="group rounded-xl border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl"
                  style={{ background: '#21262d', borderColor: '#30363d' }}>
                  <div className="aspect-video checkerboard bg-[#161b22]">
                    {p.thumbnailUrl
                      ? <img src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #161b22, #21262d)' }} />
                    }
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">{p.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#7d8590' }}>
                        {p.canvasWidth}×{p.canvasHeight} · {new Date(p.updatedAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-base opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: '#7d8590' }}>arrow_forward</span>
                  </div>
                </Link>
              ))}
              {projects.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3">
                  <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>folder_open</span>
                  <p className="text-sm" style={{ color: '#7d8590' }}>저장된 프로젝트가 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {/* 커미션 */}
          {tab === 'commission' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <span className="material-symbols-outlined text-5xl" style={{ color: '#30363d' }}>payments</span>
              <p className="font-bold text-lg" style={{ color: '#7d8590' }}>커미션 기능 준비 중</p>
              <p className="text-sm" style={{ color: '#484f58' }}>커미션 수락 및 진행 현황이 여기에 표시됩니다.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
