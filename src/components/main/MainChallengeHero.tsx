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
  // undefined = 로딩, null = 준비 중(서버가 '없음'이라고 답함). 조회 실패는 따로 — '준비 중'으로 오해하지 않게
  const [challenge, setChallenge] = useState<Challenge | null | undefined>(undefined)
  const [challengeFailed, setChallengeFailed] = useState(false)
  // 참가작 미리보기 요청 상태 — 빈 배열만으로는 '로딩 중·실패·정말 없음'을 구분할 수 없어서 분리
  const [entries, setEntries] = useState<GalleryPostSummary[]>([])
  const [entriesState, setEntriesState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    let alive = true
    challengeApi.getCurrent()
      .then(res => {
        if (!alive) return
        const c = res.data.data
        setChallenge(c)
        if (!c) return
        // 차단으로 빠질 수 있어 여유 있게 받아 앞에서 자른다
        challengeApi.getEntries(c.challengeId, 'likes', 0, PREVIEW_COUNT * 2)
          .then(list => { if (alive) { setEntries(list.data.data.content); setEntriesState('ready') } })
          .catch(() => { if (alive) setEntriesState('failed') })
      })
      .catch(() => { if (alive) setChallengeFailed(true) })
    return () => { alive = false }
  }, [])

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (waiting || (challenge === undefined && !challengeFailed)) return <SkeletonCard className="h-72 rounded-2xl" />

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

  // 조회 실패 — '준비 중'이 아니라 불러오지 못했다고 알리고, 챌린지 페이지로는 갈 수 있게
  if (challengeFailed || challenge === undefined) {
    return (
      <div className={frame} style={frameStyle}>
        {eyebrow}
        <p className="text-lg font-bold mt-2">챌린지 정보를 불러오지 못했어요</p>
        <p className="text-sm mt-1" style={muted}>잠시 후 다시 확인해 주세요.</p>
        <Link to="/community/challenge" className="mt-auto self-start text-sm font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
          챌린지 페이지로 →
        </Link>
      </div>
    )
  }

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
  // 미리보기 자리: 로딩 중엔 스켈레톤, 실패하면 비워 둠(버튼으로 이동 가능),
  // 참가작은 있는데 전부 가려졌으면(차단) '없음'이 아니라 챌린지 페이지 안내
  let previewArea
  if (entriesState === 'loading') {
    previewArea = (
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: PREVIEW_COUNT }, (_, i) => <SkeletonCard key={i} className="aspect-square rounded-lg" />)}
      </div>
    )
  } else if (entriesState === 'failed') {
    previewArea = null
  } else if (preview.length > 0) {
    previewArea = (
      <div className="grid grid-cols-4 gap-2">
        {preview.map(p => <WorkTile key={p.postId} post={p} />)}
      </div>
    )
  } else if (challenge.entryCount > 0) {
    previewArea = <p className="text-sm" style={muted}>참가작은 챌린지 페이지에서 볼 수 있어요.</p>
  } else {
    previewArea = <p className="text-sm" style={muted}>아직 참가작이 없어요. 첫 참가작을 올려 보세요.</p>
  }

  return (
    <div className={frame} style={frameStyle}>
      {eyebrow}
      <Link to="/community/challenge" className="text-2xl font-bold mt-2 line-clamp-1 hover:underline">{challenge.topic}</Link>
      {challenge.description && <p className="text-sm mt-1 line-clamp-2" style={muted}>{challenge.description}</p>}
      <p className="text-xs mt-2 flex flex-wrap gap-x-3" style={muted}>
        <span>마감까지 {left.days}일 {left.hours}시간</span>
        <span>참가작 {challenge.entryCount}</span>
      </p>

      <div className="mt-4 flex-1">{previewArea}</div>

      <Link to="/community/challenge"
        className="mt-4 self-start flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
        style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
        <span className="material-symbols-outlined text-base">emoji_events</span>
        {challenge.myEntryPostId != null ? '챌린지 보기' : '참가하기'}
      </Link>
    </div>
  )
}
