import { create } from 'zustand'
import { commissionApi, type CommissionSummary } from '../api/commissionApi'
import { useAuthStore } from './authStore'

// 진행 중 거래 — 내가 의뢰자/작가 중 어느 쪽인지 role로 구분
export interface ActiveCommission extends CommissionSummary {
  role: 'client' | 'artist'
}

// 동시 요청 합치기(dedupe) — 같은 세션(token)의 요청이 진행 중이면 그 Promise를 공유한다.
// (전역 Navbar와 CommissionPage가 함께 뜨면 훅 인스턴스가 2개라 요청이 2번 나가는 것 방지)
let inFlight: { token: string; promise: Promise<void> } | null = null

interface ActiveCommissionState {
  active: ActiveCommission[]
  loading: boolean
  /** 현재 active가 속한 세션 토큰 — 계정 전환 판별용 */
  loadedToken: string | null
  /** 진행 중 거래 조회 (거래룸 상시 진입점에서 공유). 동시 호출은 하나로 합쳐진다. */
  fetch: () => Promise<void>
  /** 로그아웃/미로그인 시 초기화 */
  clear: () => void
}

export const useActiveCommissionStore = create<ActiveCommissionState>((set, get) => ({
  active: [],
  loading: false,
  loadedToken: null,

  fetch: async () => {
    const { accessToken: token, user } = useAuthStore.getState()
    const userId = user?.userId
    if (!token || userId == null) { set({ active: [], loading: false, loadedToken: null }); return }

    // 같은 세션 요청이 이미 진행 중이면 그 결과를 공유 (중복 요청 제거)
    if (inFlight && inFlight.token === token) return inFlight.promise
    // 다른 세션(계정 전환)이면 이전 사용자 데이터를 즉시 비움
    if (get().loadedToken !== token) set({ active: [] })
    set({ loading: true })

    const promise = (async () => {
      try {
        const res = await commissionApi.getMyActive()
        if (useAuthStore.getState().accessToken !== token) return   // 로그아웃/전환으로 무효화 → 폐기
        set({
          active: res.data.data.map(c => ({
            ...c,
            role: c.clientId === userId ? 'client' : 'artist',
          })),
          loadedToken: token,
        })
      } catch {
        if (useAuthStore.getState().accessToken === token) set({ active: [] })
      } finally {
        if (useAuthStore.getState().accessToken === token) set({ loading: false })
        if (inFlight?.token === token) inFlight = null
      }
    })()

    inFlight = { token, promise }
    return promise
  },

  clear: () => {
    inFlight = null
    set({ active: [], loading: false, loadedToken: null })
  },
}))

// 진행 중 거래에서 "상대방" 닉네임 (역할 반대편)
export function partnerNickname(c: ActiveCommission): string {
  return (c.role === 'client' ? c.artistNickname : c.clientNickname) ?? '알 수 없음'
}

export const ACTIVE_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: '진행 중',
  REVIEW: '검토 중',
}
