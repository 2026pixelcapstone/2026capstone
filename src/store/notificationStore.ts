import { create } from 'zustand'
import { notificationApi } from '../api/notificationApi'
import { useAuthStore } from './authStore'

const POLL_INTERVAL_MS = 60_000 // 60초 — 레이트리밋 영향 없는 수준

interface NotificationState {
  /** 안읽음 알림 수 */
  unreadNotifications: number
  /** 안읽음 채팅 수 */
  unreadChat: number
  /** 종 배지 합계 (= unreadNotifications + unreadChat) */
  unreadTotal: number

  /** 안읽음 집계 서버 조회 (폴링/라우트 변경 시) */
  fetchUnread: () => Promise<void>
  /** 로그인 시 폴링 시작 + 즉시 1회 조회 */
  startPolling: () => void
  /** 로그아웃/언마운트 시 폴링 중지 */
  stopPolling: () => void
  /** 로그아웃 시 상태 초기화 */
  clear: () => void
}

// 인터벌 핸들은 스토어 외부에 보관 (직렬화 대상 아님)
let pollTimer: ReturnType<typeof setInterval> | null = null

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadNotifications: 0,
  unreadChat: 0,
  unreadTotal: 0,

  fetchUnread: async () => {
    // 요청 시점 토큰 캡처 — 응답 도착 시 동일 세션인지 확인 (blockStore와 동일 패턴)
    const tokenAtRequest = useAuthStore.getState().accessToken
    if (!tokenAtRequest) return
    try {
      const res = await notificationApi.getUnreadCount()
      const { isLoggedIn, accessToken } = useAuthStore.getState()
      if (!isLoggedIn || accessToken !== tokenAtRequest) return
      const { notifications, chat, total } = res.data.data
      set({ unreadNotifications: notifications, unreadChat: chat, unreadTotal: total })
    } catch {
      // 일시적 실패는 무시 — 다음 폴링에서 복구
    }
  },

  startPolling: () => {
    // 중복 시작 방지
    if (pollTimer) return
    // 즉시 1회 + 이후 주기적 조회
    void useNotificationStore.getState().fetchUnread()
    pollTimer = setInterval(() => {
      void useNotificationStore.getState().fetchUnread()
    }, POLL_INTERVAL_MS)
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  },

  clear: () => set({ unreadNotifications: 0, unreadChat: 0, unreadTotal: 0 }),
}))
