import { useEffect, useState } from 'react'
import { challengeApi, type Challenge } from '../../api/challengeApi'
import type { Visibility } from '../../api/galleryApi'

interface Props {
  visibility: Visibility
  checked: boolean
  onChange: (checked: boolean) => void
  accentColor: string
}

/**
 * 갤러리 등록 모달의 '이번 주 챌린지 참가' 체크(등록 모드에서만 붙인다).
 * 챌린지가 준비 중이면 아무것도 그리지 않는다. 공개가 아니면 비활성 — 보낼 때도 부모가 PUBLIC일 때만 보낸다.
 */
export default function ChallengeEntryCheckbox({ visibility, checked, onChange, accentColor }: Props) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)

  useEffect(() => {
    let alive = true
    challengeApi.getCurrent()
      .then(res => { if (alive) setChallenge(res.data.data) })
      .catch(() => { if (alive) setChallenge(null) })
    return () => { alive = false }
  }, [])

  if (!challenge) return null
  const isPublic = visibility === 'PUBLIC'
  const muted = { color: 'var(--color-on-surface-variant)' }

  return (
    <div>
      <label className="block text-sm font-bold mb-3">주간 챌린지</label>
      <label className={`flex items-start gap-3 px-4 py-3 rounded-xl ${isPublic ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
        style={{ background: 'var(--color-background)', border: `1px solid ${checked && isPublic ? accentColor : 'var(--color-outline)'}` }}>
        <input type="checkbox" className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ accentColor }}
          checked={checked && isPublic} disabled={!isPublic}
          onChange={e => onChange(e.target.checked)} />
        <div className="flex-1">
          <p className="text-sm font-bold">이번 주 챌린지 참가 · {challenge.topic}</p>
          <p className="text-xs mt-0.5" style={muted}>
            {!isPublic
              ? '전체 공개 작품만 참가할 수 있어요.'
              : challenge.myEntryPostId != null
                ? '이미 참가한 작품이 있어요. 체크하면 참가작이 이 작품으로 바뀌어요.'
                : '1인 1작이에요. 나중에 작품 상세에서 바꾸거나 취소할 수 있어요.'}
          </p>
        </div>
      </label>
    </div>
  )
}
