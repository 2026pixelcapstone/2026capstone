import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { userApi, type UserProfileResponse, type ProfileUpdateRequest } from '../api/userApi'
import { editorApi, type ProjectSummary } from '../api/editorApi'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'
import { assetApi, type AssetSummary } from '../api/assetApi'
import { commissionApi, type CommissionSummary } from '../api/commissionApi'
import CommissionList from '../components/CommissionList'
import { useBlockStore } from '../store/blockStore'
import { toast } from '../store/toastStore'

const TABS = [
  { key: 'works',      label: '작품',           icon: 'palette',  private: false },
  { key: 'assets',     label: '에셋',           icon: 'sell',     private: false },
  { key: 'liked',      label: '좋아요',         icon: 'favorite', private: false },
  { key: 'following',  label: '팔로잉',         icon: 'person',   private: false },
  { key: 'followers',  label: '팔로워',         icon: 'group',    private: false },
  { key: 'saved',      label: '저장된 프로젝트', icon: 'folder',   private: true  },
  { key: 'commission', label: '커미션',          icon: 'payments', private: true  },
  { key: 'blocked',    label: '차단 관리',       icon: 'block',    private: true  },
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
  const [works, setWorks] = useState<GalleryPostSummary[]>([])
  const [worksLoading, setWorksLoading] = useState(false)
  const [worksTotal, setWorksTotal] = useState<number | null>(null)
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsTotal, setAssetsTotal] = useState<number | null>(null)
  const [liked, setLiked] = useState<GalleryPostSummary[]>([])
  const [likedLoading, setLikedLoading] = useState(false)
  const [likedTotal, setLikedTotal] = useState<number | null>(null)
  const [following, setFollowing] = useState<FollowUser[]>([])
  const [followers, setFollowers] = useState<FollowUser[]>([])
  const [socialLoading, setSocialLoading] = useState(false)

  const { blockedUserIds, blockedUsers, blockedTags, unblockUser, unblockTag, loaded: blocksLoaded } = useBlockStore()

  // 커미션 탭
  const [commissions, setCommissions] = useState<{ client: CommissionSummary[]; artist: CommissionSummary[] }>({ client: [], artist: [] })
  const [commissionsLoading, setCommissionsLoading] = useState(false)
  const [commissionsLoaded, setCommissionsLoaded] = useState(false)
  const [commissionSubTab, setCommissionSubTab] = useState<'client' | 'artist'>('client')

  // 프로필 편집 모달
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<ProfileUpdateRequest>({})
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    userApi.getMe().then(res => {
      const p = res.data.data
      setProfile(p)
      // 탭 카운트를 위해 초기 데이터 미리 로드
      assetApi.getList({ authorId: p.userId, size: 20, sort: 'createdAt,desc' })
        .then(r => { setAssets(r.data.data.content); setAssetsTotal(r.data.data.totalElements) })
        .catch(() => {})
      galleryApi.getList({ likedBy: p.userId, size: 20, sort: 'createdAt,desc' })
        .then(r => { setLiked(r.data.data.content); setLikedTotal(r.data.data.totalElements) })
        .catch(() => {})
    }).catch(() => {})
    editorApi.getProjects({ size: 20 }).then(res => setProjects(res.data.data.content)).catch(() => {})
  }, [])

  // works 탭 — tab/profile/sort 변경 시 단일 useEffect로 관리 (경합 방지)
  useEffect(() => {
    if (!profile || tab !== 'works') return
    let cancelled = false
    setWorksLoading(true)
    const sortParam = sort === 'popular' ? 'likeCount,desc' : 'createdAt,desc'
    galleryApi.getList({ authorId: profile.userId, size: 20, sort: sortParam })
      .then(res => {
        if (!cancelled) {
          setWorks(res.data.data.content)
          setWorksTotal(res.data.data.totalElements)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setWorksLoading(false) })
    return () => { cancelled = true }
  }, [tab, profile, sort])

  // 에셋 탭
  useEffect(() => {
    if (!profile || tab !== 'assets' || assets.length > 0) return
    setAssetsLoading(true)
    assetApi.getList({ authorId: profile.userId, size: 20, sort: 'createdAt,desc' })
      .then(res => {
        setAssets(res.data.data.content)
        setAssetsTotal(res.data.data.totalElements)
      })
      .catch(() => {})
      .finally(() => setAssetsLoading(false))
  }, [tab, profile])

  // 좋아요 탭
  useEffect(() => {
    if (!profile || tab !== 'liked' || liked.length > 0) return
    setLikedLoading(true)
    galleryApi.getList({ likedBy: profile.userId, size: 20, sort: 'createdAt,desc' })
      .then(res => {
        setLiked(res.data.data.content)
        setLikedTotal(res.data.data.totalElements)
      })
      .catch(() => {})
      .finally(() => setLikedLoading(false))
  }, [tab, profile])

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

  // 커미션 탭 — 탭 진입 시 최초 1회만 로드
  useEffect(() => {
    if (tab !== 'commission' || commissionsLoaded) return
    setCommissionsLoading(true)
    Promise.all([
      commissionApi.getMyListAsClient({ size: 50 }),
      commissionApi.getMyListAsArtist({ size: 50 }),
    ])
      .then(([clientRes, artistRes]) => {
        setCommissions({
          client: clientRes.data.data.content,
          artist: artistRes.data.data.content,
        })
        setCommissionsLoaded(true)
      })
      .catch(() => {})
      .finally(() => setCommissionsLoading(false))
  }, [tab, commissionsLoaded])

  const handleOpenEdit = () => {
    setEditForm({
      nickname: profile?.nickname ?? '',
      bio: profile?.bio ?? '',
      websiteUrl: profile?.websiteUrl ?? '',
      isPublic: profile?.isPublic ?? true,
    })
    setEditError('')
    setShowEditModal(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm.nickname?.trim()) { setEditError('닉네임을 입력해주세요.'); return }
    setEditSubmitting(true)
    setEditError('')
    try {
      const res = await userApi.updateMe(editForm)
      setProfile(res.data.data)
      setShowEditModal(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string }; status?: number } }
      const msg = axiosErr?.response?.data?.message
      const status = axiosErr?.response?.status
      if (status === 401) {
        setEditError('로그인이 만료되었습니다. 다시 로그인해주세요.')
      } else if (msg) {
        setEditError(msg)
      } else {
        setEditError('수정에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      setEditSubmitting(false)
    }
  }

  const tabCount: Record<string, string> = {
    works:      worksTotal !== null ? worksTotal.toString() : '—',
    assets:     assetsTotal !== null ? assetsTotal.toString() : '—',
    liked:      likedTotal !== null ? likedTotal.toString() : '—',
    following:  (profile?.followingCount ?? 0).toString(),
    followers:  (profile?.followerCount ?? 0).toString(),
    saved:      projects.length.toString(),
    commission: commissionsLoaded
      ? (commissions.client.length + commissions.artist.length).toString()
      : '—',
    blocked:    blocksLoaded ? (blockedUserIds.length + blockedTags.length).toString() : '—',
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
              <button onClick={handleOpenEdit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:bg-[#292f38]"
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
            {tab === 'assets' && (
              <Link to="/assets/create"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition-all"
                style={{ background: '#2f81f7', color: '#fff' }}>
                <span className="material-symbols-outlined text-base">add</span>
                에셋 업로드
              </Link>
            )}
          </div>

          {/* 작품 탭 */}
          {tab === 'works' && (
            worksLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: '#21262d' }} />
                ))}
              </div>
            ) : works.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>palette</span>
                <p className="text-sm font-bold" style={{ color: '#7d8590' }}>아직 작품이 없습니다.</p>
                <Link to="/editor"
                  className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: '#2f81f7', color: '#fff' }}>
                  첫 작품 만들기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {works.map(w => (
                  <Link key={w.postId} to={`/gallery/${w.postId}`}
                    className="group aspect-square rounded-xl overflow-hidden relative"
                    style={{ background: '#21262d' }}>
                    {w.thumbnailUrl
                      ? <img src={w.thumbnailUrl} alt={w.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#161b22,#21262d)' }} />
                    }
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <p className="text-xs font-bold text-white text-center px-2 line-clamp-2">{w.title}</p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#ccc' }}>
                        <span>♥ {w.likeCount}</span>
                        <span>👁 {w.viewCount}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* 에셋 탭 */}
          {tab === 'assets' && (
            assetsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: '#21262d' }} />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>sell</span>
                <p className="text-sm font-bold" style={{ color: '#7d8590' }}>등록한 에셋이 없습니다.</p>
                <Link to="/assets"
                  className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: '#2f81f7', color: '#fff' }}>
                  에셋 스토어 보기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {assets.map(a => (
                  <Link key={a.assetId} to={`/assets/${a.assetId}`}
                    className="group rounded-xl overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-[#2f81f7]"
                    style={{ background: '#21262d', borderColor: '#30363d' }}>
                    <div className="aspect-square overflow-hidden">
                      {a.thumbnailUrl
                        ? <img src={a.thumbnailUrl} alt={a.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                        : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#161b22,#21262d)' }} />
                      }
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-bold truncate">{a.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold" style={{ color: a.isFree ? '#3fb950' : '#2f81f7' }}>
                          {a.isFree ? '무료' : `₩${a.price.toLocaleString()}`}
                        </span>
                        <span className="text-xs" style={{ color: '#7d8590' }}>♥ {a.likeCount}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* 좋아요 탭 */}
          {tab === 'liked' && (
            likedLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: '#21262d' }} />
                ))}
              </div>
            ) : liked.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>favorite</span>
                <p className="text-sm font-bold" style={{ color: '#7d8590' }}>좋아요한 작품이 없습니다.</p>
                <Link to="/gallery/free"
                  className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: '#2f81f7', color: '#fff' }}>
                  갤러리 둘러보기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {liked.map(w => (
                  <Link key={w.postId} to={`/gallery/${w.postId}`}
                    className="group aspect-square rounded-xl overflow-hidden relative"
                    style={{ background: '#21262d' }}>
                    {w.thumbnailUrl
                      ? <img src={w.thumbnailUrl} alt={w.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#161b22,#21262d)' }} />
                    }
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <p className="text-xs font-bold text-white text-center px-2 line-clamp-2">{w.title}</p>
                      <p className="text-xs" style={{ color: '#ccc' }}>{w.authorNickname}</p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#ccc' }}>
                        <span>♥ {w.likeCount}</span>
                        <span>👁 {w.viewCount}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
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
                        {p.width}×{p.height} · {new Date(p.updatedAt).toLocaleDateString('ko-KR')}
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
            <div>
              {/* 서브탭 */}
              <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit"
                style={{ background: '#161b22', border: '1px solid #30363d' }}>
                {(['client', 'artist'] as const).map(sub => (
                  <button key={sub}
                    onClick={() => setCommissionSubTab(sub)}
                    className="px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
                    style={{
                      background: commissionSubTab === sub ? '#2f81f7' : 'transparent',
                      color: commissionSubTab === sub ? '#fff' : '#7d8590',
                    }}>
                    {sub === 'client' ? '의뢰한 커미션' : '받은 커미션'}
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(255,255,255,0.15)' }}>
                      {sub === 'client' ? commissions.client.length : commissions.artist.length}
                    </span>
                  </button>
                ))}
              </div>

              <CommissionList
                commissions={commissionSubTab === 'client' ? commissions.client : commissions.artist}
                loading={commissionsLoading}
                perspective={commissionSubTab}
              />
            </div>
          )}

          {/* 차단 관리 */}
          {tab === 'blocked' && (
            <div className="space-y-8">
              {/* 차단된 사용자 */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color: '#7d8590' }}>
                  차단된 사용자 <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#21262d', color: '#484f58' }}>{blockedUsers.length}</span>
                </h3>
                {blockedUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-xl border" style={{ background: '#21262d', borderColor: '#30363d' }}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: '#30363d' }}>person_off</span>
                    <p className="text-sm" style={{ color: '#484f58' }}>차단된 사용자가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map(u => (
                      <div key={u.userId} className="flex items-center justify-between px-4 py-3 rounded-xl border"
                        style={{ background: '#21262d', borderColor: '#30363d' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-sm font-bold"
                            style={{ background: u.profileImageUrl ? undefined : 'linear-gradient(135deg,#30363d,#21262d)' }}>
                            {u.profileImageUrl
                              ? <img src={u.profileImageUrl} alt={u.nickname} className="w-full h-full object-cover" />
                              : <span className="material-symbols-outlined text-base" style={{ color: '#7d8590' }}>person</span>
                            }
                          </div>
                          <Link to={`/profile/${u.nickname}`}
                            className="text-sm font-medium hover:underline"
                            style={{ color: '#e6edf3' }}>
                            {u.nickname}
                          </Link>
                        </div>
                        <button onClick={async () => {
                            try { await unblockUser(u.userId); toast.success('차단이 해제되었습니다.') }
                            catch { toast.error('차단 해제에 실패했습니다.') }
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-bold transition-colors hover:bg-[#f85149]/10"
                          style={{ border: '1px solid #30363d', color: '#f85149' }}>
                          차단 해제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 차단된 태그 */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color: '#7d8590' }}>
                  차단된 태그 <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#21262d', color: '#484f58' }}>{blockedTags.length}</span>
                </h3>
                {blockedTags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-xl border" style={{ background: '#21262d', borderColor: '#30363d' }}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: '#30363d' }}>label_off</span>
                    <p className="text-sm" style={{ color: '#484f58' }}>차단된 태그가 없습니다.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {blockedTags.map(tag => (
                      <div key={tag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ background: '#21262d', border: '1px solid #30363d' }}>
                        <span className="text-sm" style={{ color: '#7d8590' }}>#{tag}</span>
                        <button onClick={async () => {
                            try { await unblockTag(tag); toast.success(`#${tag} 태그 차단이 해제되었습니다.`) }
                            catch { toast.error('태그 차단 해제에 실패했습니다.') }
                          }}
                          className="transition-colors hover:text-[#f85149]"
                          style={{ color: '#484f58' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs" style={{ color: '#484f58' }}>
                차단된 사용자와 태그가 포함된 게시물은 갤러리 피드에서 숨겨집니다. 게시물 상세 페이지에서 작가 프로필을 통해 차단할 수 있습니다.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* 프로필 편집 모달 */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowEditModal(false) }}>
          <div className="w-full max-w-md rounded-2xl border p-6"
            style={{ background: '#161b22', borderColor: '#30363d' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">프로필 편집</h2>
              <button onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#21262d] transition-colors"
                style={{ color: '#7d8590' }}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>닉네임 *</label>
                <input
                  type="text"
                  value={editForm.nickname ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))}
                  maxLength={30}
                  placeholder="영문자·숫자·한글·_  2~30자"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>바이오</label>
                <textarea
                  value={editForm.bio ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  maxLength={200}
                  placeholder="자신을 소개해보세요"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#7d8590' }}>웹사이트 URL</label>
                <input
                  type="url"
                  value={editForm.websiteUrl ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold">프로필 공개</p>
                  <p className="text-xs" style={{ color: '#7d8590' }}>비공개 시 다른 사용자에게 프로필이 숨겨집니다</p>
                </div>
                <button type="button"
                  onClick={() => setEditForm(f => ({ ...f, isPublic: !f.isPublic }))}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ background: editForm.isPublic ? '#2f81f7' : '#30363d' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ left: editForm.isPublic ? '22px' : '2px' }} />
                </button>
              </div>

              {editError && (
                <p className="text-sm" style={{ color: '#f85149' }}>{editError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:bg-[#21262d] transition-colors"
                  style={{ border: '1px solid #30363d', color: '#7d8590' }}>
                  취소
                </button>
                <button type="submit" disabled={editSubmitting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#2f81f7', color: '#fff' }}>
                  {editSubmitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
