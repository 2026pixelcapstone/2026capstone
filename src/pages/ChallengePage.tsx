import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { challengeApi, type Challenge, type ChallengeEntrySort, type PastChallenge } from '../api/challengeApi'
import type { GalleryPostSummary } from '../api/galleryApi'
import { WorkTile } from '../components/main/MainShared'
import { PRACTICE_CONSTRAINTS, PRACTICE_SUBJECTS } from '../constants/challenge'
import { useEmailGate } from '../hooks/useEmailGate'
import { formatKstDate, getRemaining } from '../lib/challengeWeek'
import { pickDifferent } from '../lib/practiceTopic'
import { useAuthStore } from '../store/authStore'
import { useBlockStore } from '../store/blockStore'

const ENTRY_PAGE_SIZE = 24
const RANK_COLORS = ['#f5c542', '#c0c4cc', '#d08a4f']

/**
 * 주간 챌린지(C-2). 이번 주 주제·기간은 서버(매주 월 00:00 KST 교체), 참가는 갤러리 등록 체크 또는 작품 상세 버튼.
 * 결과는 마감 시점 좋아요 톱3(서버 판정). 연습 주제 뽑기는 서버 없이 동작.
 */
export default function ChallengePage() {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuthStore()
  const { blockedUserIds, blockedTags, loaded: blocksLoaded } = useBlockStore()
  const { guard, gateProps } = useEmailGate()

  // ── 이번 주 챌린지 (undefined = 로딩, null = 준비 중) ──
  const [challenge, setChallenge] = useState<Challenge | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    challengeApi.getCurrent()
      .then(res => { if (alive) setChallenge(res.data.data) })
      .catch(() => { if (alive) setChallenge(null) })
    return () => { alive = false }
  }, [isLoggedIn])

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // ── 참가작 (정렬 바뀌면 처음부터, 세대 가드로 늦게 온 응답 버림) ──
  const challengeId = challenge?.challengeId ?? null
  const [sort, setSort] = useState<ChallengeEntrySort>('likes')
  const [entries, setEntries] = useState<GalleryPostSummary[]>([])
  const [entryPage, setEntryPage] = useState(0)
  const [entryLast, setEntryLast] = useState(true)
  const [entryLoading, setEntryLoading] = useState(false)
  const entryGen = useRef(0)

  const loadEntries = useCallback((id: number, s: ChallengeEntrySort, page: number) => {
    const gen = ++entryGen.current
    setEntryLoading(true)
    challengeApi.getEntries(id, s, page, ENTRY_PAGE_SIZE)
      .then(res => {
        if (gen !== entryGen.current) return
        const data = res.data.data
        setEntries(prev => page === 0 ? data.content : [...prev, ...data.content])
        setEntryPage(page)
        setEntryLast(data.last)
      })
      .catch(() => { if (gen === entryGen.current && page === 0) setEntries([]) })
      .finally(() => { if (gen === entryGen.current) setEntryLoading(false) })
  }, [])

  useEffect(() => {
    if (challengeId == null) { setEntries([]); setEntryLast(true); return }
    loadEntries(challengeId, sort, 0)
  }, [challengeId, sort, loadEntries])

  // ── 지난 챌린지 ──
  const [past, setPast] = useState<PastChallenge[] | null>(null)
  useEffect(() => {
    let alive = true
    challengeApi.getPast(0, 10)
      .then(res => { if (alive) setPast(res.data.data.content) })
      .catch(() => { if (alive) setPast([]) })
    return () => { alive = false }
  }, [])

  // ── 차단 필터(로그인 + 차단 목록 로드 완료 시) ──
  const blockActive = isLoggedIn && blocksLoaded
  const visibleEntries = useMemo(() => entries.filter(p =>
    !blockActive || (!blockedUserIds.includes(p.authorId) && !p.tags?.some(t => blockedTags.includes(t)))),
  [entries, blockActive, blockedUserIds, blockedTags])

  // ── 연습 주제 뽑기 ──
  const [subject, setSubject] = useState<string | null>(null)
  const [constraint, setConstraint] = useState<string | null>(null)
  const [withConstraint, setWithConstraint] = useState(true)
  const draw = () => {
    setSubject(prev => pickDifferent(PRACTICE_SUBJECTS, prev))
    setConstraint(prev => pickDifferent(PRACTICE_CONSTRAINTS, prev))
  }

  const card = { background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }
  const muted = { color: 'var(--color-on-surface-variant)' }
  const latest = past?.[0] ?? null
  const older = past?.slice(1) ?? []

  const goCreate = (path: string) => guard(() => navigate(isLoggedIn ? path : '/login'))

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
          {challenge === undefined ? (
            <div className="space-y-3">
              <div className="h-4 w-24 rounded animate-pulse" style={{ background: 'var(--color-surface-container-high)' }} />
              <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--color-surface-container-high)' }} />
            </div>
          ) : challenge === null ? (
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>이번 주 주제</p>
              <h1 className="text-2xl font-bold mt-1">이번 주 챌린지 준비 중</h1>
              <p className="text-sm mt-2" style={muted}>잠시 후 다시 확인해 주세요.</p>
            </div>
          ) : (() => {
            const end = new Date(challenge.endsAt)
            const lastMoment = new Date(end.getTime() - 1)   // endsAt은 미포함 경계 → 표시는 일요일
            const left = getRemaining(end, now)
            return (
              <>
                <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>이번 주 주제</p>
                <h1 className="text-3xl font-bold mt-1">{challenge.topic}</h1>
                {challenge.description && (
                  <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={muted}>{challenge.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base" style={muted}>date_range</span>
                    {formatKstDate(new Date(challenge.startsAt))} ~ {formatKstDate(lastMoment)} 23:59
                  </span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-warning)' }}>timer</span>
                    마감까지 {left.days}일 {left.hours}시간 {left.minutes}분
                  </span>
                  <span className="flex items-center gap-1.5" style={muted}>
                    <span className="material-symbols-outlined text-base">group</span>
                    참가작 {challenge.entryCount}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-6">
                  <button type="button" onClick={goCreate('/editor')} {...gateProps}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 aria-disabled:opacity-50"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                    <span className="material-symbols-outlined text-base">brush</span>그리러 가기
                  </button>
                  <button type="button" onClick={goCreate('/gallery/free')} {...gateProps}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-surface-container-high aria-disabled:opacity-50"
                    style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                    <span className="material-symbols-outlined text-base">upload</span>갤러리에 올리기
                  </button>
                  {challenge.myEntryPostId != null && (
                    <Link to={`/gallery/${challenge.myEntryPostId}`}
                      className="flex items-center gap-1.5 text-sm font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
                      <span className="material-symbols-outlined text-base">check_circle</span>내 참가작 보기
                    </Link>
                  )}
                </div>
                <p className="text-xs mt-3" style={muted}>
                  이번 주에 올린 공개 작품으로 참가해요 · 갤러리에 올릴 때 '챌린지 참가'를 체크하거나 작품 상세에서 참가 · 1인 1작(교체 가능) · 리믹스 작품 제외
                </p>
              </>
            )
          })()}
        </section>

        {/* 참가작 */}
        {challenge && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">참가작</h2>
              <div className="flex gap-1 text-xs">
                {([['likes', '좋아요순'], ['recent', '최신순']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setSort(value)} aria-pressed={sort === value}
                    className="px-3 py-1.5 rounded-lg font-bold"
                    style={sort === value
                      ? { background: 'var(--color-primary)', color: 'var(--color-on-primary)' }
                      : { background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {entryLoading && entries.length === 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="aspect-square rounded-lg animate-pulse" style={{ background: 'var(--color-surface-container-high)' }} />
                ))}
              </div>
            ) : visibleEntries.length === 0 && entryLast ? (
              <div className="rounded-2xl border py-14 flex flex-col items-center gap-2" style={card}>
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>emoji_events</span>
                <p className="text-sm" style={muted}>아직 참가작이 없습니다. 첫 참가작을 올려 보세요.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {visibleEntries.map(p => <WorkTile key={p.postId} post={p} />)}
                </div>
                {!entryLast && challengeId != null && (
                  <div className="flex justify-center mt-4">
                    <button type="button" disabled={entryLoading} onClick={() => loadEntries(challengeId, sort, entryPage + 1)}
                      className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-60"
                      style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                      {entryLoading ? '불러오는 중...' : '더 보기'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* 지난 챌린지 결과 (가장 최근 판정분) */}
        <section>
          <h2 className="font-bold mb-1">
            지난 챌린지 결과{latest ? ` · ${latest.topic}` : ''}
          </h2>
          <p className="text-xs mb-3" style={muted}>
            {latest
              ? `${formatKstDate(new Date(latest.startsAt))} 주 · 마감 시점에 좋아요를 가장 많이 받은 작품`
              : '마감 시점에 좋아요를 가장 많이 받은 3작품'}
          </p>
          {past === null ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: 'var(--color-surface-container-high)' }} />)}
            </div>
          ) : !latest || latest.winners.length === 0 ? (
            <div className="rounded-2xl border py-10 flex flex-col items-center gap-2" style={card}>
              <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-outline)' }}>workspace_premium</span>
              <p className="text-sm" style={muted}>{latest ? '이 주에는 참가작이 없었어요.' : '아직 결과가 없습니다.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {latest.winners.map(w => (
                <div key={w.rank} className="flex flex-col gap-1.5">
                  {w.post ? (
                    <WorkTile post={w.post} />
                  ) : (
                    <div className="aspect-square rounded-lg border flex items-center justify-center text-xs text-center px-2" style={{ ...card, ...muted }}>
                      볼 수 없는 작품
                    </div>
                  )}
                  <p className="text-sm font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-base" style={{ color: RANK_COLORS[w.rank - 1] }}>workspace_premium</span>
                    {w.rank}위
                    <span className="text-xs font-normal truncate" style={muted}>
                      {w.post ? `${w.post.authorNickname} · ` : ''}♥ {w.likeCount}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 그 이전 챌린지 */}
          {older.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold mb-2">이전 챌린지</h3>
              <ul className="rounded-2xl border divide-y" style={{ ...card, borderColor: 'var(--color-outline)' }}>
                {older.map(c => {
                  const first = c.winners.find(w => w.rank === 1)
                  return (
                    <li key={c.challengeId} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--color-outline)' }}>
                      <span className="text-xs w-24 shrink-0" style={muted}>{formatKstDate(new Date(c.startsAt))} 주</span>
                      <span className="font-bold text-sm flex-1 truncate">{c.topic}</span>
                      {first?.post ? (
                        <Link to={`/gallery/${first.post.postId}`} className="text-xs flex items-center gap-1 hover:underline shrink-0">
                          <span className="material-symbols-outlined text-sm" style={{ color: RANK_COLORS[0] }}>workspace_premium</span>
                          {first.post.authorNickname}
                        </Link>
                      ) : (
                        <span className="text-xs shrink-0" style={muted}>{c.winners.length === 0 ? '참가작 없음' : '—'}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
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
