import type { ReactNode } from 'react'
import type { UserProfileResponse } from '../../api/userApi'

interface ProfileHeaderProps {
  /** 아직 로드 전이면 null — 자리표시('...')로 그림 */
  profile: Pick<UserProfileResponse, 'nickname' | 'role' | 'profileImageUrl' | 'bio' | 'websiteUrl'> | null
  /** 닉네임 아래 한 줄(이메일·가입일 등) */
  subline: ReactNode
  /** 오른쪽 버튼 영역(마이페이지=새 작품·편집 / 프로필=팔로우·차단) */
  actions: ReactNode
  stats: { label: string; value: string }[]
}

/** 마이페이지·프로필 공용 상단 — 커버 배너 + 인포 바(아바타·이름·역할·바이오·웹사이트·통계) */
export default function ProfileHeader({ profile, subline, actions, stats }: ProfileHeaderProps) {
  return (
    <>
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
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{subline}</p>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2 sm:mb-1">{actions}</div>
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
            {stats.map(({ label, value }) => (
              <div key={label}>
                <span className="font-bold">{value}</span>
                <span className="ml-1" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
