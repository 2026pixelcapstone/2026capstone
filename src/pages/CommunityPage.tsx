import { Link } from 'react-router-dom'

/** 커뮤니티 허브 — 게시판형이 아니라 함께 만들고 나누는 공간. 팔레트·주간 챌린지·공동 캔버스 */
interface Section { key: string; title: string; icon: string; to: string | null; desc: string }

// to가 null이면 '준비 중' 카드(새 섹션을 열기 전 자리 표시용)
const SECTIONS: Section[] = [
  { key: 'palettes', title: '팔레트', icon: 'palette', to: '/community/palettes',
    desc: '색 조합을 공유하고, 마음에 드는 팔레트를 받아 에디터에서 바로 써 보세요.' },
  { key: 'challenge', title: '주간 챌린지', icon: 'emoji_events', to: '/community/challenge',
    desc: '매주 새 주제로 그리고, 좋아요를 가장 많이 받은 작품을 뽑아요. 연습 주제 뽑기도 있어요.' },
  { key: 'canvas', title: '공동 픽셀 캔버스', icon: 'grid_on', to: '/community/canvas',
    desc: '모두가 한 칸씩 찍어 함께 완성하는 큰 캔버스.' },
]

export default function CommunityPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold">커뮤니티</h1>
        <p className="text-sm mt-1 mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
          픽셀 아티스트들과 함께 만들고 나누는 공간
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SECTIONS.map(s => {
            const inner = (
              <>
                <span className="material-symbols-outlined text-3xl" style={{ color: s.to ? 'var(--color-primary)' : 'var(--color-outline)' }}>{s.icon}</span>
                <div className="flex items-center gap-2 mt-3">
                  <h2 className="font-bold">{s.title}</h2>
                  {!s.to && (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>준비 중</span>
                  )}
                </div>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{s.desc}</p>
              </>
            )
            const style = { background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }
            return s.to
              ? <Link key={s.key} to={s.to} className="rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-primary" style={style}>{inner}</Link>
              : <div key={s.key} className="rounded-2xl border p-5 opacity-70" style={style} aria-disabled="true">{inner}</div>
          })}
        </div>
      </div>
    </div>
  )
}
