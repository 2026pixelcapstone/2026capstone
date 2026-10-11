import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { challengeApi, type Challenge } from '../../api/challengeApi'
import type { GalleryPostSummary } from '../../api/galleryApi'
import { getRemaining } from '../../lib/challengeWeek'
import { SkeletonCard, WorkTile } from './MainShared'

const PREVIEW_COUNT = 4

interface Props {
  /** 차단 목록 로드 전이면 true — 스켈레톤으로 대기(차단 작품 깜빡임 방지) */
  waiting: boolean
  /** 차단 필터(메인 공용) — 참가작 미리보기는 단순 목록이라 차단 작품은 뺀다 */
  isVisible: (p: GalleryPostSummary) => boolean
}

/** 메인 히어로 오른쪽 — 이번 주 챌린지(주제·남은 시간·참가 수·참가작 미리보기) */
export default function MainChallengeHero({ waiting, isVisible }: Props) {
  // undefined = 로딩, null = 준비 중
  const [challenge, setChallenge] = useState<Challenge | null | undefined>(undefined)
  const [entries, setEntries] = useState<GalleryPostSummary[]>([])

  useEffect(() => {
    let alive = true
    challengeApi.getCurrent()
      .then(async res => {
        const c = res.data.data
        if (!alive) return
        setChallenge(c)
        if (!c) return
        // 차단으로 빠질 수 있어 여유 있게 받아 앞에서 자른다
        const list = await challengeApi.getEntries(c.challengeId, 'likes', 0, PREVIEW_COUNT * 2)
        if (alive) setEntries(list.data.data.content)
      })
      .catch(() => { if (alive) setChallenge(prev => prev === undefined ? null : prev) })
    return () => { alive = false }
  }, [])

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (waiting || challenge === undefined) return <SkeletonCard className="h-72 rounded-2xl" />

  const frame = 'min-h-72 rounded-2xl border p-5 flex flex-col'
  const frameStyle = {
    background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-warning) 16%, var(--color-surface-container)), var(--color-surface-container))',
    borderColor: 'var(--color-outline)',
  }
  const muted = { color: 'var(--color-on-surface-variant)' }
  const eyebrow = (
    <p className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
      <span className="material-symbols-outlined text-base">emoji_events</span>이번 주 챌린지
    </p>
  )

  if (challenge === null) {
    return (
      <div className={frame} style={frameStyle}>
        {eyebrow}
        <p className="text-2xl font-bold mt-2">준비 중</p>
        <p className="text-sm mt-1" style={muted}>이번 주 챌린지가 곧 열려요.</p>
      </div>
    )
  }

  const left = getRemaining(new Date(challenge.endsAt), now)
  const preview = entries.filter(isVisible).slice(0, PREVIEW_COUNT)

  return (
    <div className={frame} style={frameStyle}>
      {eyebrow}
      <Link to="/community/challenge" className="text-2xl font-bold mt-2 line-clamp-1 hover:underline">{challenge.topic}</Link>
      {challenge.description && <p className="text-sm mt-1 line-clamp-2" style={muted}>{challenge.description}</p>}
      <p className="text-xs mt-2 flex flex-wrap gap-x-3" style={muted}>
        <span>마감까지 {left.days}일 {left.hours}시간</span>
        <span>참가작 {challenge.entryCount}</span>
      </p>

      <div className="mt-4 flex-1">
        {preview.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {preview.map(p => <WorkTile key={p.postId} post={p} />)}
          </div>
        ) : (
          <p className="text-sm" style={muted}>아직 참가작이 없어요. 첫 참가작을 올려 보세요.</p>
        )}
      </div>

      <Link to="/community/challenge"
        className="mt-4 self-start flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
        style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
        <span className="material-symbols-outlined text-base">emoji_events</span>
        {challenge.myEntryPostId != null ? '챌린지 보기' : '참가하기'}
      </Link>
    </div>
  )
}
