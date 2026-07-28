import { useEffect, useState } from 'react'
import { commissionApi, type CommissionSummary } from '../api/commissionApi'
import { useAuthStore } from '../store/authStore'

// 진행 중 거래 — 어느 쪽(의뢰자/작가)에서 왔는지 role로 구분
export interface ActiveCommission extends CommissionSummary {
  role: 'client' | 'artist'
}

/**
 * 로그인 사용자의 "진행 중(IN_PROGRESS/REVIEW)" 거래 목록.
 * 의뢰자/작가 두 목록을 합쳐 필터·중복제거·최신순 정렬한다.
 *
 * PR-1(#74)에서 4라운드에 걸쳐 다듬은 비동기+인증 race 가드를 여기 한 곳에 캡슐화:
 * 로그아웃/계정 전환으로 effect가 재실행되면 이전 요청의 늦은 응답을 버린다(ignore).
 * (거래룸 상시 진입점 Navbar E-1 · 커미션 페이지 배너 E-2 등에서 재사용)
 */
export function useActiveCommissions(): { active: ActiveCommission[]; loading: boolean } {
  const { isLoggedIn } = useAuthStore()
  const [active, setActive] = useState<ActiveCommission[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) { setActive([]); setLoading(false); return }
    let ignore = false
    setLoading(true)
    Promise.allSettled([
      commissionApi.getMyListAsClient({ size: 20 }),
      commissionApi.getMyListAsArtist({ size: 20 }),
    ])
      .then(([c, a]) => {
        if (ignore) return   // 로그아웃/전환으로 무효화된 요청의 응답 폐기
        const merged: ActiveCommission[] = []
        if (c.status === 'fulfilled')
          merged.push(...c.value.data.data.content.map(x => ({ ...x, role: 'client' as const })))
        if (a.status === 'fulfilled')
          merged.push(...a.value.data.data.content.map(x => ({ ...x, role: 'artist' as const })))
        const seen = new Set<number>()
        setActive(
          merged
            .filter(x => x.status === 'IN_PROGRESS' || x.status === 'REVIEW')
            .filter(x => (seen.has(x.commissionId) ? false : (seen.add(x.commissionId), true)))
            .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())
        )
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [isLoggedIn])

  return { active, loading }
}

// 진행 중 거래에서 "상대방" 닉네임 (역할 반대편)
export function partnerNickname(c: ActiveCommission): string {
  return (c.role === 'client' ? c.artistNickname : c.clientNickname) ?? '알 수 없음'
}

export const ACTIVE_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: '진행 중',
  REVIEW: '검토 중',
}
