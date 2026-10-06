import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { userApi, type UserProfileResponse, type ProfileUpdateRequest } from '../api/userApi'
import CommissionList from '../components/CommissionList'
import { useBlockStore } from '../store/blockStore'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useProfileTabs, type SortKey } from '../hooks/useProfileTabs'
import ProfileHeader from '../components/profile/ProfileHeader'
import { ProfileTabSidebar, ProfileTabMobile, SortToggle, type ProfileTab } from '../components/profile/ProfileTabs'
import { WorkCard, AssetCard, LibraryAssetCard, UserCard, EmptyTab, GridSkeleton, CardGrid } from '../components/profile/ProfileCards'
import ProfileImageField from '../components/profile/ProfileImageField'

const TABS: ProfileTab[] = [
  { key: 'works',      label: '작품',           icon: 'palette',  private: false },
  { key: 'assets',     label: '에셋',           icon: 'sell',     private: false },
  { key: 'liked',      label: '좋아요',         icon: 'favorite', private: false },
  { key: 'following',  label: '팔로잉',         icon: 'person',   private: false },
  { key: 'followers',  label: '팔로워',         icon: 'group',    private: false },
  { key: 'saved',      label: '저장된 프로젝트', icon: 'folder',   private: true  },
  { key: 'library',    label: '구매/받은 에셋',  icon: 'shopping_bag', private: true },
  { key: 'commission', label: '커미션',          icon: 'payments', private: true  },
  { key: 'blocked',    label: '차단 관리',       icon: 'block',    private: true  },
]

// 페이지 진입 시 숫자를 미리 받아 둘 탭(팔로잉/팔로워는 프로필 응답에 숫자가 있고, 차단은 blockStore 담당)
const COUNT_TABS = ['works', 'assets', 'liked', 'saved', 'library', 'commission'] as const

export default function MyPage() {
  const [tab, setTab]   = useState('works')
  const [sort, setSort] = useState<SortKey>('recent')
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const uid = profile?.userId
  // uid만 의존 — 프로필 수정으로 profile 객체가 바뀌어도 탭 재요청 안 함
  const {
    works, assets, liked, following, followers, saved: projects, commissions, library,
    totals, commissionTotals, libraryTotals, showSpinner, isLoaded, loadFailed, reload,
  } = useProfileTabs({ userId: uid, tab, sort, prefetch: COUNT_TABS })

  const { blockedUserIds, blockedUsers, blockedTags, unblockUser, unblockTag, loaded: blocksLoaded } = useBlockStore()

  const [commissionSubTab, setCommissionSubTab] = useState<'client' | 'artist'>('client')
  const [librarySubTab, setLibrarySubTab] = useState<'purchased' | 'free'>('purchased')
  const libraryItems = librarySubTab === 'purchased' ? library.purchased : library.free

  // 프로필 편집 모달
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<ProfileUpdateRequest>({})
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)   // 사진 자르는 중·업로드 중
  const editModalRef = useRef<HTMLDivElement>(null)

  // 모든 닫기 경로(X·취소·배경·ESC)가 여기로 — 저장 요청 중·사진 작업 중에는 닫지 않음
  const closeEditModal = () => { if (!editSubmitting && !imageBusy) setShowEditModal(false) }

  // 사진 업로드·삭제 결과를 화면 프로필과 로그인 사용자 정보(내비 아바타)에 함께 반영
  const handleImageChanged = (p: UserProfileResponse) => {
    setProfile(p)
    const { user, setUser } = useAuthStore.getState()
    if (user) setUser({ ...user, profileImageUrl: p.profileImageUrl ?? undefined })
  }
  useFocusTrap(showEditModal, editModalRef, closeEditModal)

  useEffect(() => {
    userApi.getMe().then(res => setProfile(res.data.data)).catch(() => {})
  }, [])

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
    if (imageBusy) return   // 사진 자르기·업로드 중엔 저장(=모달 닫기)하지 않음 — 작업 유실 방지
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
    library:    countOf('library'),
    commission: countOf('commission'),
    blocked:    blocksLoaded ? (blockedUserIds.length + blockedTags.length).toString() : '—',
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>

      <ProfileHeader
        profile={profile}
        subline={<>
          {profile?.email}
          {profile?.createdAt && ` · 가입 ${new Date(profile.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}`}
        </>}
        actions={<>
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
        </>}
        stats={[
          { label: '팔로워', value: followerCount.toLocaleString() },
          { label: '팔로잉', value: followingCount.toLocaleString() },
          { label: '프로젝트', value: tabCount.saved },
        ]}
      />

      {/* 탭 + 콘텐츠 */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 flex gap-6 items-start">
        <ProfileTabSidebar tabs={TABS} active={tab} onChange={setTab} counts={tabCount} />

        {/* 콘텐츠 */}
        <div className="flex-1 min-w-0">
          <ProfileTabMobile tabs={TABS} active={tab} onChange={setTab} />

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base">
              {TABS.find(t => t.key === tab)?.label}
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>
                {tabCount[tab]}
              </span>
            </h2>
            {tab === 'works' && <SortToggle sort={sort} onChange={setSort} />}
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
            showSpinner('works') ? <GridSkeleton variant="square" />
            : works.length === 0 ? <EmptyTab icon="palette" text="아직 작품이 없습니다." action={{ to: '/editor', label: '첫 작품 만들기' }} />
            : <CardGrid variant="square">{works.map(w => <WorkCard key={w.postId} post={w} />)}</CardGrid>
          )}

          {/* 에셋 탭 */}
          {tab === 'assets' && (
            showSpinner('assets') ? <GridSkeleton variant="square" />
            : assets.length === 0 ? <EmptyTab icon="sell" text="등록한 에셋이 없습니다." action={{ to: '/assets', label: '에셋 스토어 보기' }} />
            : <CardGrid variant="square">{assets.map(a => <AssetCard key={a.assetId} asset={a} />)}</CardGrid>
          )}

          {/* 좋아요 탭 */}
          {tab === 'liked' && (
            showSpinner('liked') ? <GridSkeleton variant="square" />
            : liked.length === 0 ? <EmptyTab icon="favorite" text="좋아요한 작품이 없습니다." action={{ to: '/gallery/free', label: '갤러리 둘러보기' }} />
            : <CardGrid variant="square">{liked.map(w => <WorkCard key={w.postId} post={w} showAuthor />)}</CardGrid>
          )}

          {/* 팔로잉 */}
          {tab === 'following' && (
            showSpinner('following') ? <GridSkeleton variant="user" />
            : following.length === 0 ? <EmptyTab icon="person" text="팔로잉 중인 유저가 없습니다." />
            : <CardGrid variant="user">{following.map(u => <UserCard key={u.userId} user={u} />)}</CardGrid>
          )}

          {/* 팔로워 */}
          {tab === 'followers' && (
            showSpinner('followers') ? <GridSkeleton variant="user" />
            : followers.length === 0 ? <EmptyTab icon="group" text="팔로워가 없습니다." />
            : <CardGrid variant="user">{followers.map(u => <UserCard key={u.userId} user={u} />)}</CardGrid>
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
              {isLoaded('saved') && projects.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3">
                  <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>folder_open</span>
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>저장된 프로젝트가 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {/* 구매/받은 에셋 */}
          {tab === 'library' && (
            <div>
              {/* 서브탭 — 커미션 탭과 같은 모양 */}
              <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}>
                {(['purchased', 'free'] as const).map(sub => (
                  <button key={sub}
                    onClick={() => setLibrarySubTab(sub)}
                    className="px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
                    style={{
                      background: librarySubTab === sub ? 'var(--color-primary)' : 'transparent',
                      color: librarySubTab === sub ? '#fff' : 'var(--color-on-surface-variant)',
                    }}>
                    {sub === 'purchased' ? '구매' : '무료'}
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(255,255,255,0.15)' }}>
                      {libraryTotals ? libraryTotals[sub] : '—'}
                    </span>
                  </button>
                ))}
              </div>

              {/* 실패를 '없음'으로 보이지 않게 — 받은 적 없으면 실패 안내 또는 스켈레톤, 빈 상태 문구는 받은 뒤에만 */}
              {loadFailed('library') ? (
                <div role="alert" className="flex flex-col items-center justify-center py-24 gap-3">
                  <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>cloud_off</span>
                  <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>구매/받은 에셋을 불러오지 못했습니다.</p>
                  <button type="button" onClick={() => reload('library')}
                    className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                    다시 시도
                  </button>
                </div>
              )
                : !isLoaded('library') ? <GridSkeleton variant="square" />
                : libraryItems.length === 0
                  ? <EmptyTab icon="shopping_bag"
                      text={librarySubTab === 'purchased' ? '아직 구매한 에셋이 없습니다.' : '아직 무료로 받은 에셋이 없습니다.'}
                      action={{ to: '/assets', label: '에셋 스토어 보기' }} />
                  : <CardGrid variant="square">{libraryItems.map(item => <LibraryAssetCard key={item.purchaseId} item={item} />)}</CardGrid>}
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
          onClick={e => { if (e.target === e.currentTarget) closeEditModal() }}
          role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
          <div ref={editModalRef} className="w-full max-w-md rounded-2xl border p-6"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 id="profile-edit-title" className="text-lg font-bold">프로필 편집</h2>
              <button type="button" onClick={closeEditModal} aria-label="닫기"
                className="p-1.5 rounded-lg hover:bg-surface-container transition-colors"
                style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
              </button>
            </div>

            <div className="mb-5">
              <ProfileImageField
                imageUrl={profile?.profileImageUrl ?? null}
                nickname={profile?.nickname ?? ''}
                onChanged={handleImageChanged}
                onBusyChange={setImageBusy}
              />
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="profile-edit-nickname" className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>닉네임 *</label>
                <input
                  id="profile-edit-nickname"
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
                <label htmlFor="profile-edit-bio" className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>바이오</label>
                <textarea
                  id="profile-edit-bio"
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
                <label htmlFor="profile-edit-website" className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>웹사이트 URL</label>
                <input
                  id="profile-edit-website"
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
                  <p id="profile-edit-public-label" className="text-sm font-bold">프로필 공개</p>
                  <p id="profile-edit-public-desc" className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>비공개 시 다른 사용자에게 프로필이 숨겨집니다</p>
                </div>
                <button type="button"
                  role="switch" aria-checked={!!editForm.isPublic}
                  aria-labelledby="profile-edit-public-label" aria-describedby="profile-edit-public-desc"
                  onClick={() => setEditForm(f => ({ ...f, isPublic: !f.isPublic }))}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ background: editForm.isPublic ? 'var(--color-primary)' : 'var(--color-surface-container-highest)' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ left: editForm.isPublic ? '22px' : '2px' }} />
                </button>
              </div>

              {editError && (
                <p role="alert" className="text-sm" style={{ color: 'var(--color-error)' }}>{editError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeEditModal}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:bg-surface-container transition-colors"
                  style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                  취소
                </button>
                <button type="submit" disabled={editSubmitting || imageBusy}
                  className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
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
