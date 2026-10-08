import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CURRENT_CHALLENGE, PRACTICE_CONSTRAINTS, PRACTICE_SUBJECTS } from '../constants/challenge'
import { pickDifferent } from '../lib/practiceTopic'
import { formatKstDate, getChallengeWeek, getRemaining } from '../lib/challengeWeek'

/**
 * 주간 챌린지(C-2) — 지금은 화면 틀. 주제는 하드코딩, 참가·결과는 빈 상태,
 * 연습 주제 뽑기만 실제로 동작(서버 불필요). 기간은 KST 월 00:00 ~ 일 23:59.
 */
export default function ChallengePage() {
  const [now, setNow] = useState(() => new Date())
  const week = getChallengeWeek(now)
  const left = getRemaining(week.end, now)

  // 남은 시간 표시 갱신(분 단위라 30초마다면 충분)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const [subject, setSubject] = useState<string | null>(null)
  const [constraint, setConstraint] = useState<string | null>(null)
  const [withConstraint, setWithConstraint] = useState(true)
  const draw = () => {
    setSubject(prev => pickDifferent(PRACTICE_SUBJECTS, prev))
    setConstraint(prev => pickDifferent(PRACTICE_CONSTRAINTS, prev))
  }

  const card = { background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }
  const muted = { color: 'var(--color-on-surface-variant)' }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-center gap-2 text-sm" style={muted}>
          <Link to="/community" className="hover:underline">커뮤니티</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span style={{ color: 'var(--color-on-surface)' }}>주간 챌린지</span>
        </div>

        {/* 이번 주 챌린지 */}
        <section className="rounded-2xl border p-6 sm:p-8"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-container)), var(--color-surface-container))', borderColor: 'var(--color-outline)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>이번 주 주제</p>
          <h1 className="text-3xl font-bold mt-1">{CURRENT_CHALLENGE.topic}</h1>
          <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={muted}>{CURRENT_CHALLENGE.description}</p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base" style={muted}>date_range</span>
              {formatKstDate(week.start)} ~ {formatKstDate(week.end)} 23:59
            </span>
            <span className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-warning)' }}>timer</span>
              마감까지 {left.days}일 {left.hours}시간 {left.minutes}분
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button type="button" disabled
              className="px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              참여하기
            </button>
            <p className="text-xs" style={muted}>갤러리에 작품을 올릴 때 '챌린지 참가'를 체크하면 참여돼요 · 1인 1작(교체 가능)</p>
          </div>
        </section>

        {/* 참가작 */}
        <section>
          <h2 className="font-bold mb-3">참가작</h2>
          <div className="rounded-2xl border py-14 flex flex-col items-center gap-2" style={card}>
            <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>emoji_events</span>
            <p className="text-sm" style={muted}>아직 참가작이 없습니다.</p>
          </div>
        </section>

        {/* 지난 주 결과 */}
        <section>
          <h2 className="font-bold mb-1">지난 주 결과</h2>
          <p className="text-xs mb-3" style={muted}>마감 시점에 좋아요를 가장 많이 받은 3작품</p>
          <div className="grid grid-cols-3 gap-3">
            {['1위', '2위', '3위'].map((rank, i) => (
              <div key={rank} className="aspect-square rounded-xl border flex flex-col items-center justify-center gap-1" style={card}>
                <span className="material-symbols-outlined text-3xl"
                  style={{ color: ['#f5c542', '#c0c4cc', '#d08a4f'][i] }}>workspace_premium</span>
                <span className="text-sm font-bold">{rank}</span>
                <span className="text-xs" style={muted}>—</span>
              </div>
            ))}
          </div>
        </section>

        {/* 연습 주제 뽑기 */}
        <section className="rounded-2xl border p-6" style={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">연습 주제 뽑기</h2>
              <p className="text-xs mt-0.5" style={muted}>뭘 그릴지 모르겠다면 하나 뽑아 보세요.</p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={muted}>
              <input type="checkbox" checked={withConstraint} onChange={e => setWithConstraint(e.target.checked)}
                className="w-4 h-4 accent-primary" />
              제약 조건도 함께
            </label>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-h-16 rounded-xl px-5 py-4 flex flex-wrap items-center gap-x-3 gap-y-1"
              style={{ background: 'var(--color-surface-container-low)' }} aria-live="polite">
              {subject ? (
                <>
                  <span className="text-2xl font-bold">{subject}</span>
                  {withConstraint && constraint && (
                    <span className="text-sm px-2 py-0.5 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                      {constraint}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm" style={muted}>버튼을 눌러 주제를 뽑아 보세요</span>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={draw}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                <span className="material-symbols-outlined text-base">casino</span>
                {subject ? '다시 뽑기' : '뽑기'}
              </button>
              {subject && (
                <Link to="/editor"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-surface-container-high"
                  style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                  <span className="material-symbols-outlined text-base">brush</span>
                  그리러 가기
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
