import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useActiveCommissionStore, type ActiveCommission } from '../store/activeCommissionStore'

// 타입·헬퍼는 스토어가 소유. consumer는 기존처럼 이 훅에서 import (재노출).
export { partnerNickname, ACTIVE_STATUS_LABEL } from '../store/activeCommissionStore'
export type { ActiveCommission } from '../store/activeCommissionStore'

/**
 * 로그인 사용자의 "진행 중(IN_PROGRESS/REVIEW)" 거래 목록.
 *
 * 실제 조회·상태는 `activeCommissionStore`가 소유하며, 이 훅은 마운트/계정 변화 시
 * 스토어 fetch를 트리거하고 공유 상태를 반환하는 얇은 래퍼다. 여러 컴포넌트
 * (전역 Navbar E-1 · CommissionPage 배너 E-2 등)가 함께 써도 요청은 스토어에서
 * 하나로 합쳐지고(dedupe) 같은 목록을 본다.
 *
 * 서버 전용 엔드포인트(`GET /api/commissions/my/active`)가 양쪽 역할을 합쳐 상태로
 * 필터·정렬해 전체를 반환한다(페이지 첫 20건에 밀려 누락되던 문제 해결).
 */
export function useActiveCommissions(): { active: ActiveCommission[]; loading: boolean } {
  const { isLoggedIn, user } = useAuthStore()
  const userId = user?.userId
  const active = useActiveCommissionStore(s => s.active)
  const loading = useActiveCommissionStore(s => s.loading)
  const fetch = useActiveCommissionStore(s => s.fetch)
  const clear = useActiveCommissionStore(s => s.clear)

  // 로그인/계정 변화에 반응 — 로그아웃·미로그인은 초기화, 그 외엔 스토어 조회 트리거.
  // userId를 의존성에 포함해 계정 전환(A→B)에도 재조회된다.
  useEffect(() => {
    if (!isLoggedIn || userId == null) { clear(); return }
    void fetch()
  }, [isLoggedIn, userId, fetch, clear])

  return { active, loading }
}
