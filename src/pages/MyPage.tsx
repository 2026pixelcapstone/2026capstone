import { useState, useEffect, useRef, useCallback } from 'react'
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

type SortKey = 'recent' | 'popular'

// 페이지 진입 시 숫자를 미리 받아 둘 탭(팔로잉/팔로워는 프로필 응답에 숫자가 있고, 차단은 blockStore 담당)
const COUNT_TABS = ['works', 'assets', 'liked', 'saved', 'commission']

/** 탭 하나의 응답을 화면에 반영할 형태로 묶은 것 — total은 서버 전체 개수(totalElements) */
type TabData =
  | { key: 'works' | 'liked'; items: GalleryPostSummary[]; total: number }
  | { key: 'assets'; items: AssetSummary[]; total: number }
  | { key: 'following' | 'followers'; items: FollowUser[]; total: number }
  | { key: 'saved'; items: ProjectSummary[]; total: number }
  | { key: 'commission'; client: CommissionSummary[]; artist: CommissionSummary[]; clientTotal: number; artistTotal: number }

/** 탭 데이터 요청 — state를 건드리지 않는 순수 함수(반영 여부는 호출부가 세대 가드로 결정). 차단 탭은 null. */
async function loadTab(key: string, userId: number, sort: SortKey): Promise<TabData | null> {
  switch (key) {
    case 'works': {
      const sortParam = sort === 'popular' ? 'likeCount,desc' : 'createdAt,desc'
      const page = (await galleryApi.getList({ authorId: userId, size: 20, sort: sortParam })).data.data
      return { key, items: page.content, total: page.totalElements }
    }
    case 'liked': {
      const page = (await galleryApi.getList({ likedBy: userId, size: 20, sort: 'createdAt,desc' })).data.data
      return { key, items: page.content, total: page.totalElements }
    }
    case 'assets': {
      const page = (await assetApi.getList({ authorId: userId, size: 20, sort: 'createdAt,desc' })).data.data
      return { key, items: page.content, total: page.totalElements }
    }
    case 'following':
    case 'followers': {
      const res = key === 'following' ? await userApi.getFollowing(userId) : await userApi.getFollowers(userId)
      const items = res.data.data as unknown as FollowUser[]
      return { key, items, total: items.length }   // 목록 전체가 오므로 길이가 곧 최신 개수
    }
    case 'saved': {
      const page = (await editorApi.getProjects({ size: 20 })).data.data
      return { key, items: page.content, total: page.totalElements }
    }
    case 'commission': {
      const [client, artist] = await Promise.all([
        commissionApi.getMyListAsClient({ size: 50 }),
        commissionApi.getMyListAsArtist({ size: 50 }),
      ])
      return {
        key,
        client: client.data.data.content, artist: artist.data.data.content,
        clientTotal: client.data.data.totalElements, artistTotal: artist.data.data.totalElements,
      }
    }
    default:
      return null
  }
}

export default function MyPage() {
  const [tab, setTab]   = useState('works')
  const [sort, setSort] = useState<SortKey>('recent')
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [works, setWorks] = useState<GalleryPostSummary[]>([])
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [liked, setLiked] = useState<GalleryPostSummary[]>([])
  const [following, setFollowing] = useState<FollowUser[]>([])
  const [followers, setFollowers] = useState<FollowUser[]>([])

  // 탭 공통 로딩 상태 — key: 탭 이름
  const [totals, setTotals] = useState<Record<string, number>>({})          // 서버 기준 전체 개수
  const [loadingTabs, setLoadingTabs] = useState<Record<string, boolean>>({}) // 요청 중
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({})   // 한 번이라도 받음
  // 탭별 요청 세대 — 같은 탭의 마지막 요청 응답만 반영(늦게 온 옛 응답 무시, TROUBLESHOOTING #26)
  const reqGen = useRef<Record<string, number>>({})

  const { blockedUserIds, blockedUsers, blockedTags, unblockUser, unblockTag, loaded: blocksLoaded } = useBlockStore()

  // 커미션 탭
  const [commissions, setCommissions] = useState<{ client: CommissionSummary[]; artist: CommissionSummary[] }>({ client: [], artist: [] })
  const [commissionTotals, setCommissionTotals] = useState<{ client: number; artist: number } | null>(null)
  const [commissionSubTab, setCommissionSubTab] = useState<'client' | 'artist'>('client')

  // 프로필 편집 모달
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<ProfileUpdateRequest>({})
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    userApi.getMe().then(res => setProfile(res.data.data)).catch(() => {})
  }, [])

  /** 탭 하나를 (다시) 받아 반영. 같은 탭의 더 새 요청이 있으면 이 응답은 버림. 실패 시 기존 데이터 유지. */
  const refreshTab = useCallback(async (key: string, userId: number, sortKey: SortKey) => {
    if (key === 'blocked') return   // 차단 목록은 blockStore가 관리
    const gen = (reqGen.current[key] ?? 0) + 1
    reqGen.current[key] = gen
    setLoadingTabs(s => ({ ...s, [key]: true }))
    try {
      const data = await loadTab(key, userId, sortKey)
      if (!data || reqGen.current[key] !== gen) return
      switch (data.key) {
        case 'works':      setWorks(data.items); break
        case 'liked':      setLiked(data.items); break
        case 'assets':     setAssets(data.items); break
        case 'following':  setFollowing(data.items); break
        case 'followers':  setFollowers(data.items); break
        case 'saved':      setProjects(data.items); break
        case 'commission':
          setCommissions({ client: data.client, artist: data.artist })
          setCommissionTotals({ client: data.clientTotal, artist: data.artistTotal })
          break
      }
      const total = data.key === 'commission' ? data.clientTotal + data.artistTotal : data.total
      setTotals(s => ({ ...s, [key]: total }))
      setLoadedTabs(s => ({ ...s, [key]: true }))
    } catch {
      // 실패 시 기존 데이터·숫자 유지
    } finally {
      if (reqGen.current[key] === gen) setLoadingTabs(s => ({ ...s, [key]: false }))
    }
  }, [])

  const uid = profile?.userId

  // 활성 탭 — 들어올 때마다 다시 받음(작품 탭은 정렬 변경 시에도). uid만 의존: 프로필 수정으로 profile 객체가 바뀌어도 재요청 안 함
  useEffect(() => {
    if (uid) void refreshTab(tab, uid, sort)
  }, [uid, tab, sort, refreshTab])

  // 탭 숫자 — 내 정보가 확정되면 한 번, 숫자가 필요한 탭을 미리 받음(활성 탭은 위 effect가 담당하므로 제외)
  useEffect(() => {
    if (!uid) return
    COUNT_TABS.filter(k => k !== tab).forEach(k => void refreshTab(k, uid, sort))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uid 확정 시 1회만(tab/sort 변경은 위 effect 담당)
  }, [uid, refreshTab])

  /** 스피너는 "아직 한 번도 못 받은 탭을 받는 중"일 때만 — 이미 본 탭은 기존 내용을 보여주며 뒤에서 갱신 */
  const showSpinner = (key: string) => !!loadingTabs[key] && !loadedTabs[key]

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

  // 팔로잉/팔로워: 목록을 받았으면 그 길이(최신), 아니면 프로필 응답의 숫자
  const followingCount = totals.following ?? profile?.followingCount ?? 0
  const followerCount  = totals.followers ?? profile?.followerCount ?? 0
  const countOf = (key: string) => totals[key] !== undefined ? totals[key].toString() : '—'

  const tabCount: Record<string, string> = {
    works:      countOf('works'),
    assets:     countOf('assets'),
    liked:      countOf('liked'),
    following:  followingCount.toString(),
    followers:  followerCount.toString(),
    saved:      countOf('saved'),
    commission: countOf('commission'),
    blocked:    blocksLoaded ? (blockedUserIds.length + blockedTags.length).toString() : '—',
  }

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
                  {profile?.profileImageUrl
                    ? <img src={profile.profileImageUrl} alt={profile.nickname} className="w-full h-full object-cover" />
                    : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-2xl"
                        style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))', color: '#fff' }}>
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
                    style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}>
                    {profile?.role ?? 'USER'}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {profile?.email}
                  {profile?.createdAt && ` · 가입 ${new Date(profile.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}`}
                </p>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2 sm:mb-1">
              <Link to="/editor"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))', color: '#fff' }}>
                <span className="material-symbols-outlined text-base">add</span>
                새 작품
              </Link>
              <button onClick={handleOpenEdit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:bg-surface-container-high"
                style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                <span className="material-symbols-outlined text-base">edit</span>
                프로필 편집
              </button>
            </div>
          </div>

          {/* 바이오 */}
          {(profile?.bio || profile?.websiteUrl) && (
            <div className="pb-4 max-w-2xl">
              {profile?.bio && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{profile.bio}</p>
              )}
              {profile?.websiteUrl && (
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
              [followerCount.toLocaleString(), '팔로워'],
              [followingCount.toLocaleString(), '팔로잉'],
              [tabCount.saved, '프로젝트'],
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
        <nav className="hidden sm:flex flex-col flex-shrink-0 w-44 sticky top-[4.5rem] gap-0.5">
          {TABS.map((t, i) => (
            <div key={t.key}>
              {t.private && !TABS[i - 1]?.private && (
                <div className="my-2 border-t" style={{ borderColor: 'var(--color-surface-container)' }} />
              )}
              <button onClick={() => setTab(t.key)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-left transition-all"
                style={tab === t.key
                  ? { background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }
                  : { color: 'var(--color-on-surface-variant)' }}>
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
                    background: tab === t.key ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-surface-container)',
                    color: tab === t.key ? 'var(--color-primary)' : 'var(--color-outline-strong)',
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
                  ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }
                  : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base">
              {TABS.find(t => t.key === tab)?.label}
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>
                {tabCount[tab]}
              </span>
            </h2>
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
            {tab === 'saved' && (
              <Link to="/editor"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition-all"
                style={{ background: 'var(--color-primary)', color: '#fff' }}>
                <span className="material-symbols-outlined text-base">add</span>
                새 프로젝트
              </Link>
            )}
            {tab === 'assets' && (
              <Link to="/assets/create"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition-all"
                style={{ background: 'var(--color-primary)', color: '#fff' }}>
                <span className="material-symbols-outlined text-base">add</span>
                에셋 업로드
              </Link>
            )}
          </div>

          {/* 작품 탭 */}
          {tab === 'works' && (
            showSpinner('works') ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
                ))}
              </div>
            ) : works.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>palette</span>
                <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>아직 작품이 없습니다.</p>
                <Link to="/editor"
                  className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>
                  첫 작품 만들기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {works.map(w => (
                  <Link key={w.postId} to={`/gallery/${w.postId}`}
                    className="group aspect-square rounded-xl overflow-hidden relative"
                    style={{ background: 'var(--color-surface-container)' }}>
                    {w.thumbnailUrl
                      ? <img src={w.thumbnailUrl} alt={w.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,var(--color-surface),var(--color-surface-container))' }} />
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
            showSpinner('assets') ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>sell</span>
                <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>등록한 에셋이 없습니다.</p>
                <Link to="/assets"
                  className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>
                  에셋 스토어 보기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {assets.map(a => (
                  <Link key={a.assetId} to={`/assets/${a.assetId}`}
                    className="group rounded-xl overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-primary"
                    style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                    <div className="aspect-square overflow-hidden">
                      {a.thumbnailUrl
                        ? <img src={a.thumbnailUrl} alt={a.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                        : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,var(--color-surface),var(--color-surface-container))' }} />
                      }
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

          {/* 좋아요 탭 */}
          {tab === 'liked' && (
            showSpinner('liked') ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
                ))}
              </div>
            ) : liked.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>favorite</span>
                <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>좋아요한 작품이 없습니다.</p>
                <Link to="/gallery/free"
                  className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>
                  갤러리 둘러보기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {liked.map(w => (
                  <Link key={w.postId} to={`/gallery/${w.postId}`}
                    className="group aspect-square rounded-xl overflow-hidden relative"
                    style={{ background: 'var(--color-surface-container)' }}>
                    {w.thumbnailUrl
                      ? <img src={w.thumbnailUrl} alt={w.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,var(--color-surface),var(--color-surface-container))' }} />
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
            showSpinner('following') ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-4 animate-pulse"
                    style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)', height: 140 }} />
                ))}
              </div>
            ) : following.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>person</span>
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>팔로잉 중인 유저가 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {following.map(u => (
                  <Link key={u.userId} to={`/profile/${u.nickname}`}
                    className="rounded-xl border p-4 text-center hover:shadow-md hover:border-primary transition-all"
                    style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-2 overflow-hidden"
                      style={{ background: u.profileImageUrl ? undefined : 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))' }}>
                      {u.profileImageUrl
                        ? <img src={u.profileImageUrl} alt={u.nickname} className="w-full h-full object-cover" />
                        : u.nickname.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div className="font-bold text-sm">{u.nickname}</div>
                    <div className="text-xs mt-0.5 mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                      팔로워 {u.followerCount.toLocaleString()}
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)', color: 'var(--color-primary)' }}>
                      팔로잉
                    </span>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* 팔로워 */}
          {tab === 'followers' && (
            showSpinner('followers') ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-4 animate-pulse"
                    style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)', height: 140 }} />
                ))}
              </div>
            ) : followers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>group</span>
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>팔로워가 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {followers.map(u => (
                  <Link key={u.userId} to={`/profile/${u.nickname}`}
                    className="rounded-xl border p-4 text-center hover:shadow-md hover:border-primary transition-all"
                    style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-2 overflow-hidden"
                      style={{ background: u.profileImageUrl ? undefined : 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))' }}>
                      {u.profileImageUrl
                        ? <img src={u.profileImageUrl} alt={u.nickname} className="w-full h-full object-cover" />
                        : u.nickname.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div className="font-bold text-sm">{u.nickname}</div>
                    <div className="text-xs mt-0.5 mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                      팔로워 {u.followerCount.toLocaleString()}
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
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
                  style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                  <div className="aspect-video checkerboard bg-surface">
                    {p.thumbnailUrl
                      ? <img src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-container))' }} />
                    }
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">{p.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {p.width}×{p.height} · {new Date(p.updatedAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-base opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-on-surface-variant)' }}>arrow_forward</span>
                  </div>
                </Link>
              ))}
              {loadedTabs.saved && projects.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3">
                  <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>folder_open</span>
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>저장된 프로젝트가 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {/* 커미션 */}
          {tab === 'commission' && (
            <div>
              {/* 서브탭 */}
              <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}>
                {(['client', 'artist'] as const).map(sub => (
                  <button key={sub}
                    onClick={() => setCommissionSubTab(sub)}
                    className="px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
                    style={{
                      background: commissionSubTab === sub ? 'var(--color-primary)' : 'transparent',
                      color: commissionSubTab === sub ? '#fff' : 'var(--color-on-surface-variant)',
                    }}>
                    {sub === 'client' ? '의뢰한 커미션' : '받은 커미션'}
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(255,255,255,0.15)' }}>
                      {commissionTotals ? commissionTotals[sub] : '—'}
                    </span>
                  </button>
                ))}
              </div>

              <CommissionList
                commissions={commissionSubTab === 'client' ? commissions.client : commissions.artist}
                loading={showSpinner('commission')}
                perspective={commissionSubTab}
              />
            </div>
          )}

          {/* 차단 관리 */}
          {tab === 'blocked' && (
            <div className="space-y-8">
              {/* 차단된 사용자 */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                  차단된 사용자 <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'var(--color-surface-container)', color: 'var(--color-outline-strong)' }}>{blockedUsers.length}</span>
                </h3>
                {blockedUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-xl border" style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-outline)' }}>person_off</span>
                    <p className="text-sm" style={{ color: 'var(--color-outline-strong)' }}>차단된 사용자가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map(u => (
                      <div key={u.userId} className="flex items-center justify-between px-4 py-3 rounded-xl border"
                        style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-sm font-bold"
                            style={{ background: u.profileImageUrl ? undefined : 'linear-gradient(135deg,var(--color-surface-container-highest),var(--color-surface-container))' }}>
                            {u.profileImageUrl
                              ? <img src={u.profileImageUrl} alt={u.nickname} className="w-full h-full object-cover" />
                              : <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-on-surface-variant)' }}>person</span>
                            }
                          </div>
                          <Link to={`/profile/${u.nickname}`}
                            className="text-sm font-medium hover:underline"
                            style={{ color: 'var(--color-on-surface)' }}>
                            {u.nickname}
                          </Link>
                        </div>
                        <button onClick={async () => {
                            try { await unblockUser(u.userId); toast.success('차단이 해제되었습니다.') }
                            catch { toast.error('차단 해제에 실패했습니다.') }
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-bold transition-colors hover:bg-error/10"
                          style={{ border: '1px solid var(--color-outline)', color: 'var(--color-error)' }}>
                          차단 해제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 차단된 태그 */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                  차단된 태그 <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'var(--color-surface-container)', color: 'var(--color-outline-strong)' }}>{blockedTags.length}</span>
                </h3>
                {blockedTags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-xl border" style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-outline)' }}>label_off</span>
                    <p className="text-sm" style={{ color: 'var(--color-outline-strong)' }}>차단된 태그가 없습니다.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {blockedTags.map(tag => (
                      <div key={tag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)' }}>
                        <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>#{tag}</span>
                        <button onClick={async () => {
                            try { await unblockTag(tag); toast.success(`#${tag} 태그 차단이 해제되었습니다.`) }
                            catch { toast.error('태그 차단 해제에 실패했습니다.') }
                          }}
                          className="transition-colors hover:text-error"
                          style={{ color: 'var(--color-outline-strong)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs" style={{ color: 'var(--color-outline-strong)' }}>
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
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">프로필 편집</h2>
              <button onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container transition-colors"
                style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>닉네임 *</label>
                <input
                  type="text"
                  value={editForm.nickname ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))}
                  maxLength={30}
                  placeholder="영문자·숫자·한글·_  2~30자"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>바이오</label>
                <textarea
                  value={editForm.bio ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  maxLength={200}
                  placeholder="자신을 소개해보세요"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>웹사이트 URL</label>
                <input
                  type="url"
                  value={editForm.websiteUrl ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold">프로필 공개</p>
                  <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>비공개 시 다른 사용자에게 프로필이 숨겨집니다</p>
                </div>
                <button type="button"
                  onClick={() => setEditForm(f => ({ ...f, isPublic: !f.isPublic }))}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ background: editForm.isPublic ? 'var(--color-primary)' : 'var(--color-surface-container-highest)' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ left: editForm.isPublic ? '22px' : '2px' }} />
                </button>
              </div>

              {editError && (
                <p className="text-sm" style={{ color: 'var(--color-error)' }}>{editError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:bg-surface-container transition-colors"
                  style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                  취소
                </button>
                <button type="submit" disabled={editSubmitting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>
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
