import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { challengeApi, isEligibleForChallenge, type Challenge } from '../../api/challengeApi'
import type { GalleryPostResponse } from '../../api/galleryApi'
import { useEmailGate } from '../../hooks/useEmailGate'
import { getErrorMessage } from '../../lib/errorUtils'
import { toast } from '../../store/toastStore'

/**
 * 작품 상세(작성자 본인용) — 이번 주 챌린지 참가·교체·취소.
 * 참가 중이 아니고 조건(이번 주 작성·공개·리믹스 아님)도 안 맞으면 아무것도 그리지 않는다.
 * 버튼 노출은 화면 판단이고, 실제 참가 가능 여부는 서버가 다시 검사한다.
 */
export default function ChallengeEntryCard({ post }: { post: GalleryPostResponse }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [busy, setBusy] = useState(false)
  const { guard, gateProps } = useEmailGate()

  useEffect(() => {
    let alive = true
    challengeApi.getCurrent()
      .then(res => { if (alive) setChallenge(res.data.data) })
      .catch(() => { if (alive) setChallenge(null) })
    return () => { alive = false }
  }, [post.postId])

  if (!challenge) return null
  const entered = challenge.myEntryPostId === post.postId
  if (!entered && !isEligibleForChallenge(post, challenge)) return null

  const enter = async () => {
    if (busy) return
    if (challenge.myEntryPostId != null
      && !window.confirm('이미 참가한 작품이 있어요. 참가작을 이 작품으로 바꿀까요?')) return
    setBusy(true)
    try {
      const res = await challengeApi.enter(post.postId)
      setChallenge(prev => prev && { ...prev, myEntryPostId: post.postId })
      toast.success(res.data.data.result === 'REPLACED' ? '참가작을 이 작품으로 바꿨어요.' : '이번 주 챌린지에 참가했어요.')
    } catch (err) {
      toast.error(getErrorMessage(err, '챌린지 참가에 실패했습니다.'))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (busy || !window.confirm('챌린지 참가를 취소할까요?')) return
    setBusy(true)
    try {
      await challengeApi.cancel()
      setChallenge(prev => prev && { ...prev, myEntryPostId: null })
      toast.success('챌린지 참가를 취소했어요.')
    } catch (err) {
      toast.error(getErrorMessage(err, '참가 취소에 실패했습니다.'))
    } finally {
      setBusy(false)
    }
  }

  const muted = { color: 'var(--color-on-surface-variant)' }

  return (
    <div className="rounded-2xl border p-5"
      style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, var(--color-surface-container))', borderColor: 'var(--color-outline)' }}>
      <p className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
        <span className="material-symbols-outlined text-base">emoji_events</span>이번 주 챌린지
      </p>
      <Link to="/community/challenge" className="block font-bold mt-1 hover:underline">{challenge.topic}</Link>

      {entered ? (
        <>
          <p className="text-sm mt-2">이 작품으로 참가 중이에요.</p>
          {post.visibility !== 'PUBLIC' && (
            <p className="text-xs mt-1" style={muted}>비공개 상태라 참가작 목록과 결과에서 빠져 있어요. 다시 공개하면 돌아와요.</p>
          )}
          <button type="button" onClick={cancel} disabled={busy}
            className="w-full mt-3 py-2 rounded-xl text-sm font-bold disabled:opacity-60"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
            참가 취소
          </button>
        </>
      ) : (
        <>
          <p className="text-xs mt-2" style={muted}>
            {challenge.myEntryPostId != null ? '다른 작품으로 참가 중이에요. 이 작품으로 바꿀 수 있어요.' : '이 작품으로 참가할 수 있어요. 1인 1작이에요.'}
          </p>
          <button type="button" onClick={guard(enter)} disabled={busy} {...gateProps}
            className="w-full mt-3 py-2 rounded-xl text-sm font-bold disabled:opacity-60 aria-disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
            {challenge.myEntryPostId != null ? '이 작품으로 바꾸기' : '이번 주 챌린지 참가'}
          </button>
        </>
      )}
    </div>
  )
}
