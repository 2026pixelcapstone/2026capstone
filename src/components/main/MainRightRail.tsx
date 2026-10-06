import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PaletteSummary } from '../../api/paletteApi'
import type { PopularUser } from '../../api/userApi'
import { CURRENT_CHALLENGE } from '../../constants/challenge'
import { SHARED_CANVAS_PALETTE } from '../../constants/sharedCanvas'
import { getChallengeWeek, getRemaining } from '../../lib/challengeWeek'
import { drawPracticeTopic } from '../../lib/practiceTopic'
import { PaletteStrip } from '../palette/PaletteCard'
import { RailCard, gradientOf } from './MainShared'

interface MainRightRailProps {
  palettes: PaletteSummary[]
  artists: PopularUser[]
  loading: boolean
}

/** 공동 캔버스 미리보기용 작은 무늬(장식) — 실제 캔버스 데이터가 아님 */
const CANVAS_PREVIEW = Array.from({ length: 8 * 16 }, (_, i) => SHARED_CANVAS_PALETTE[(i * 7 + Math.floor(i / 16) * 3) % SHARED_CANVAS_PALETTE.length])

/** 메인 오른쪽 '커뮤니티' 레일 — 챌린지·연습 주제·인기 팔레트·공동 캔버스·인기 작가 */
export default function MainRightRail({ palettes, artists, loading }: MainRightRailProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const left = getRemaining(getChallengeWeek(now).end, now)
  const [topic, setTopic] = useState<{ subject: string; constraint: string } | null>(null)
  const muted = { color: 'var(--color-on-surface-variant)' }

  return (
    <div className="flex flex-col gap-4">
      {/* 이번 주 챌린지 */}
      <Link to="/community/challenge" className="rounded-xl border p-4 block hover:-translate-y-0.5 transition-transform"
        style={{ background: 'color-mix(in srgb, var(--color-warning) 14%, var(--color-surface-container))', borderColor: 'var(--color-outline)' }}>
        <p className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
          <span className="material-symbols-outlined text-base">emoji_events</span>이번 주 챌린지
        </p>
        <p className="text-lg font-bold mt-1">{CURRENT_CHALLENGE.topic}</p>
        <p className="text-xs mt-0.5" style={muted}>마감까지 {left.days}일 {left.hours}시간</p>
      </Link>

      {/* 연습 주제 뽑기 */}
      <RailCard title="연습 주제 뽑기" icon="casino">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm min-w-0" aria-live="polite">
            {topic
              ? <><span className="font-bold">{topic.subject}</span> <span className="text-xs" style={muted}>· {topic.constraint}</span></>
              : <span className="text-xs" style={muted}>뭘 그릴지 모르겠다면</span>}
          </p>
          <button type="button" onClick={() => setTopic(prev => drawPracticeTopic(prev))}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
            {topic ? '다시' : '뽑기'}
          </button>
        </div>
      </RailCard>

      {/* 인기 팔레트 */}
      <RailCard title="인기 팔레트" icon="palette" to="/community/palettes" linkLabel="더 보기">
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-7 rounded animate-pulse" style={{ background: 'var(--color-surface-container-high)' }} />)}</div>
        ) : palettes.length === 0 ? (
          <p className="text-xs" style={muted}>아직 팔레트가 없습니다.</p>
        ) : (
          <ul className="space-y-2.5">
            {palettes.slice(0, 3).map(p => (
              <li key={p.paletteId}>
                <Link to={`/community/palettes/${p.paletteId}`} className="block hover:opacity-90">
                  <PaletteStrip colors={p.colors} height={18} />
                  <p className="text-xs mt-1 flex justify-between"><span className="truncate">{p.name}</span><span style={muted}>♥ {p.likeCount}</span></p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RailCard>

      {/* 공동 캔버스 */}
      <RailCard title="공동 픽셀 캔버스" icon="grid_on" to="/community/canvas" linkLabel="참여">
        <Link to="/community/canvas" className="block rounded overflow-hidden" aria-label="공동 픽셀 캔버스로 이동">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
            {CANVAS_PREVIEW.map((c, i) => <div key={i} className="aspect-square" style={{ background: c, opacity: 0.85 }} />)}
          </div>
        </Link>
        <p className="text-xs mt-2" style={muted}>한 칸씩 찍어 함께 완성해요</p>
      </RailCard>

      {/* 인기 작가 */}
      <RailCard title="인기 작가" icon="star" to="/gallery/free" linkLabel="갤러리">
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-8 rounded animate-pulse" style={{ background: 'var(--color-surface-container-high)' }} />)}</div>
        ) : artists.length === 0 ? (
          <p className="text-xs" style={muted}>아직 작가가 없습니다.</p>
        ) : (
          <ol className="space-y-1">
            {artists.slice(0, 6).map((a, i) => (
              <li key={a.userId}>
                <Link to={`/profile/${a.nickname}`} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-surface-container-high">
                  <span className="w-4 text-xs font-bold text-center" style={muted}>{i + 1}</span>
                  {a.profileImageUrl
                    ? <img src={a.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                    : <div className="w-7 h-7 rounded-full" style={{ background: gradientOf(a.userId) }} />}
                  <span className="text-sm truncate flex-1">{a.nickname}</span>
                  {a.recentLikes > 0 && <span className="text-xs" style={muted}>♥ {a.recentLikes}</span>}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </RailCard>
    </div>
  )
}
