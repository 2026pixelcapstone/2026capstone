import { Link } from 'react-router-dom'
import type { UserProfileResponse } from '../../api/userApi'
import type { ProjectSummary } from '../../api/editorApi'
import { ACTIVE_STATUS_LABEL, partnerNickname, type ActiveCommission } from '../../hooks/useActiveCommissions'
import { RailCard, gradientOf } from './MainShared'

interface MainLeftRailProps {
  /** rail: 넓은 화면 왼쪽 세로 레일 / inline: 그보다 좁을 때 가운데 맨 위 가로 배치 */
  variant: 'rail' | 'inline'
  isLoggedIn: boolean
  me: UserProfileResponse | null
  projects: ProjectSummary[]
  active: ActiveCommission[]
}

const SHORTCUTS = [
  { to: '/editor', icon: 'brush', label: '새 작품 그리기' },
  { to: '/assets/create', icon: 'upload', label: '에셋 등록' },
  { to: '/community/palettes', icon: 'palette', label: '팔레트' },
  { to: '/mypage', icon: 'shopping_bag', label: '구매/받은 에셋' },
]

const GUEST_SHORTCUTS = [
  { to: '/gallery/free', icon: 'photo_library', label: '갤러리 둘러보기' },
  { to: '/assets', icon: 'storefront', label: '에셋 스토어' },
  { to: '/community', icon: 'groups', label: '커뮤니티' },
]

/** 메인 왼쪽 '나' 레일 — 로그인: 프로필 요약·이어 그리기·진행 중 거래·바로가기 / 로그아웃: 가입 안내 + 둘러보기 */
export default function MainLeftRail({ variant, isLoggedIn, me, projects, active }: MainLeftRailProps) {
  const layout = variant === 'rail' ? 'flex flex-col gap-4' : 'grid gap-4 sm:grid-cols-2'
  const muted = { color: 'var(--color-on-surface-variant)' }

  if (!isLoggedIn) {
    return (
      <div className={layout}>
        <section className="rounded-xl border p-4"
          style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container))', borderColor: 'var(--color-outline)' }}>
          <h3 className="font-bold">픽셀아트, 여기서 시작해요</h3>
          <p className="text-xs mt-1 leading-relaxed" style={muted}>그리고, 공유하고, 팔고, 함께 만드는 픽셀 아티스트 공간</p>
          <div className="flex gap-2 mt-3">
            <Link to="/signup" className="px-3 py-1.5 rounded-lg text-sm font-bold" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>가입하기</Link>
            <Link to="/login" className="px-3 py-1.5 rounded-lg text-sm font-bold" style={{ border: '1px solid var(--color-outline)' }}>로그인</Link>
          </div>
        </section>
        <RailCard title="둘러보기" icon="explore">
          <ul className="space-y-1">
            {GUEST_SHORTCUTS.map(s => (
              <li key={s.to}>
                <Link to={s.to} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-surface-container-high">
                  <span className="material-symbols-outlined text-base" style={muted}>{s.icon}</span>{s.label}
                </Link>
              </li>
            ))}
          </ul>
        </RailCard>
      </div>
    )
  }

  return (
    <div className={layout}>
      {/* 프로필 요약 */}
      <Link to="/mypage" className="rounded-xl border p-4 flex items-center gap-3 hover:bg-surface-container-high transition-colors"
        style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
        {me?.profileImageUrl
          ? <img src={me.profileImageUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
          : <div className="w-11 h-11 rounded-full shrink-0" style={{ background: gradientOf(me?.userId ?? 0) }} />}
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{me?.nickname ?? '…'}</p>
          <p className="text-xs" style={muted}>팔로워 {me?.followerCount ?? 0} · 팔로잉 {me?.followingCount ?? 0}</p>
        </div>
      </Link>

      {/* 이어 그리기 */}
      <RailCard title="이어 그리기" icon="brush" to="/mypage" linkLabel="전체">
        {projects.length === 0 ? (
          <Link to="/editor" className="text-xs hover:underline" style={muted}>저장한 프로젝트가 없어요. 새로 그려 볼까요?</Link>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {projects.slice(0, 3).map(p => (
              <Link key={p.projectId} to={`/editor?projectId=${p.projectId}`} title={p.title}
                className="aspect-square rounded-md overflow-hidden checkerboard border hover:opacity-90" style={{ borderColor: 'var(--color-outline)' }}>
                {p.thumbnailUrl && <img src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />}
              </Link>
            ))}
          </div>
        )}
      </RailCard>

      {/* 진행 중 거래 */}
      {active.length > 0 && (
        <RailCard title={`진행 중 거래 ${active.length}건`} icon="handshake" to="/commission?tab=mine" linkLabel="전체">
          <ul className="space-y-1.5">
            {active.slice(0, 3).map(c => (
              <li key={c.commissionId}>
                <Link to={`/commission/${c.commissionId}`} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg hover:bg-surface-container-high">
                  <span className="truncate">
                    <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{ACTIVE_STATUS_LABEL[c.status] ?? c.status}</span>
                    {' '}{c.title ?? '커미션 거래'} · @{partnerNickname(c)}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 px-1.5 rounded-full font-bold" style={{ background: 'var(--color-error)', color: 'var(--color-on-primary)' }}>{c.unreadCount}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </RailCard>
      )}

      {/* 바로가기 */}
      <RailCard title="바로가기" icon="bolt">
        <ul className="space-y-1">
          {SHORTCUTS.map(s => (
            <li key={s.to}>
              <Link to={s.to} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-base" style={muted}>{s.icon}</span>{s.label}
              </Link>
            </li>
          ))}
        </ul>
      </RailCard>
    </div>
  )
}
