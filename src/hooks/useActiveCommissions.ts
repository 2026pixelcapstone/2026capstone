import { useEffect, useState } from 'react'
import { commissionApi, type CommissionSummary } from '../api/commissionApi'
import { useAuthStore } from '../store/authStore'

// 진행 중 거래 — 어느 쪽(의뢰자/작가)에서 왔는지 role로 구분
export interface ActiveCommission extends CommissionSummary {
  role: 'client' | 'artist'
}

/**
 * 로그인 사용자의 "진행 중(IN_PROGRESS/REVIEW)" 거래 목록.
 * 서버 전용 엔드포인트(`GET /api/commissions/my/active`)가 양쪽 역할을 합쳐
 * 상태로 필터·정렬해 전체를 반환한다(페이지 첫 20건에 밀려 누락되던 문제 해결).
 * role은 내 userId가 의뢰자/작가 중 어느 쪽인지로 판정.
 *
 * PR-1(#74)에서 4라운드에 걸쳐 다듬은 비동기+인증 race 가드를 여기 한 곳에 캡슐화:
 * 로그아웃/계정 전환으로 effect가 재실행되면 이전 요청의 늦은 응답을 버린다(ignore).
 * (거래룸 상시 진입점 Navbar E-1 · 커미션 페이지 배너 E-2 등에서 재사용)
 */
export function useActiveCommissions(): { active: ActiveCommission[]; loading: boolean } {
  const { isLoggedIn, user } = useAuthStore()
  const userId = user?.userId
  const [active, setActive] = useState<ActiveCommission[]>([])
  const [loading, setLoading] = useState(false)

  // userId를 의존성에 포함 — 로그인 상태가 true인 채로 계정이 바뀌어도(A→B) effect가 재실행돼
  // 이전 계정 데이터가 남지 않도록 한다(거래 제목·상대·미읽음 노출 방지).
  useEffect(() => {
    if (!isLoggedIn || userId == null) { setActive([]); setLoading(false); return }
    let ignore = false
    setLoading(true)
    commissionApi.getMyActive()
      .then(res => {
        if (ignore) return   // 로그아웃/전환으로 무효화된 요청의 응답 폐기
        setActive(res.data.data.map(c => ({
          ...c,
          role: c.clientId === userId ? 'client' : 'artist',
        })))
      })
      .catch(() => { if (!ignore) setActive([]) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [isLoggedIn, userId])

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
