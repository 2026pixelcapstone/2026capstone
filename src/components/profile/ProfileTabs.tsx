export interface ProfileTab {
  key: string
  label: string
  icon: string
  /** 본인만 보는 탭 — 자물쇠 표시 + 첫 비공개 탭 위 구분선 */
  private?: boolean
}

interface ProfileTabsProps {
  tabs: ProfileTab[]
  active: string
  onChange: (key: string) => void
  /** 탭 옆 숫자. 생략하면 숫자 배지 없음 */
  counts?: Record<string, string>
}

/** 데스크톱 좌측 탭 사이드바 */
export function ProfileTabSidebar({ tabs, active, onChange, counts }: ProfileTabsProps) {
  return (
    <nav className="hidden sm:flex flex-col flex-shrink-0 w-44 sticky top-[4.5rem] gap-0.5">
      {tabs.map((t, i) => (
        <div key={t.key}>
          {t.private && !tabs[i - 1]?.private && (
            <div className="my-2 border-t" style={{ borderColor: 'var(--color-surface-container)' }} />
          )}
          <button onClick={() => onChange(t.key)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-left transition-all"
            style={active === t.key
              ? { background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }
              : { color: 'var(--color-on-surface-variant)' }}>
            <span className="material-symbols-outlined text-base flex-shrink-0"
              style={{ fontVariationSettings: active === t.key ? "'FILL' 1" : "'FILL' 0" }}>
              {t.icon}
            </span>
            <span className="flex-1 flex items-center gap-1">
              {t.label}
              {t.private && (
                <span className="material-symbols-outlined opacity-40" style={{ fontSize: 12 }}>lock</span>
              )}
            </span>
            {counts && (
              <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: active === t.key ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-surface-container)',
                  color: active === t.key ? 'var(--color-primary)' : 'var(--color-outline-strong)',
                }}>
                {counts[t.key]}
              </span>
            )}
          </button>
        </div>
      ))}
    </nav>
  )
}

/** 모바일 가로 스크롤 탭 */
export function ProfileTabMobile({ tabs, active, onChange }: Omit<ProfileTabsProps, 'counts'>) {
  return (
    <div className="flex sm:hidden overflow-x-auto no-scrollbar gap-1 mb-4">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          style={active === t.key
            ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }
            : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** 정렬 토글(최신순/인기순) — 작품 탭 헤더 */
export function SortToggle({ sort, onChange }: { sort: 'recent' | 'popular'; onChange: (s: 'recent' | 'popular') => void }) {
  return (
    <div className="flex gap-1">
      {(['recent', 'popular'] as const).map(s => (
        <button key={s} onClick={() => onChange(s)}
          className="px-3 py-1 rounded-lg text-xs font-bold transition-colors"
          style={sort === s
            ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }
            : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
          {s === 'recent' ? '최신순' : '인기순'}
        </button>
      ))}
    </div>
  )
}
