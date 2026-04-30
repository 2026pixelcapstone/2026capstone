import { create } from 'zustand'
import { blockApi } from '../api/blockApi'
import { useAuthStore } from './authStore'

interface BlockState {
  blockedUserIds: number[]
  blockedTags: string[]
  loaded: boolean

  /** 로그인 후 서버에서 차단 목록 불러오기 */
  fetchBlocks: () => Promise<void>

  /** 로그아웃 시 초기화 */
  clearBlocks: () => void

  blockUser: (userId: number) => Promise<void>
  unblockUser: (userId: number) => Promise<void>
  blockTag: (tag: string) => Promise<void>
  unblockTag: (tag: string) => Promise<void>

  isUserBlocked: (userId: number) => boolean
  isTagBlocked: (tag: string) => boolean
}

export const useBlockStore = create<BlockState>((set, get) => ({
  blockedUserIds: [],
  blockedTags: [],
  loaded: false,

  fetchBlocks: async () => {
    // 요청 시점의 토큰 캡처 — 응답 도착 시 동일 세션인지 확인
    const tokenAtRequest = useAuthStore.getState().accessToken
    try {
      const res = await blockApi.getMyBlocks()
      const { isLoggedIn, accessToken } = useAuthStore.getState()
      // 로그아웃됐거나 계정이 바뀐 경우 응답 무시
      if (!isLoggedIn || accessToken !== tokenAtRequest) return
      set({
        blockedUserIds: res.data.data.blockedUserIds,
        blockedTags: res.data.data.blockedTags,
        loaded: true,
      })
    } catch {
      // 비로그인 상태 등 에러는 무시
    }
  },

  clearBlocks: () => set({ blockedUserIds: [], blockedTags: [], loaded: false }),

  blockUser: async (userId) => {
    // 이 항목이 요청 전에 존재했는지만 기록 → 동시 요청 간 충돌 없는 조건부 롤백
    const wasBlocked = get().blockedUserIds.includes(userId)
    if (!wasBlocked) {
      set(s => ({ blockedUserIds: [...s.blockedUserIds, userId] }))
    }
    try {
      await blockApi.blockUser(userId)
    } catch {
      if (!wasBlocked) {
        set(s => ({ blockedUserIds: s.blockedUserIds.filter(id => id !== userId) }))
      }
      throw new Error('차단에 실패했습니다.')
    }
  },

  unblockUser: async (userId) => {
    const wasBlocked = get().blockedUserIds.includes(userId)
    if (wasBlocked) {
      set(s => ({ blockedUserIds: s.blockedUserIds.filter(id => id !== userId) }))
    }
    try {
      await blockApi.unblockUser(userId)
    } catch {
      if (wasBlocked) {
        // 중복 추가 방지: 롤백 전 현재 배열에 없는 경우에만 재추가
        set(s => ({
          blockedUserIds: s.blockedUserIds.includes(userId)
            ? s.blockedUserIds
            : [...s.blockedUserIds, userId],
        }))
      }
      throw new Error('차단 해제에 실패했습니다.')
    }
  },

  blockTag: async (tag) => {
    const wasBlocked = get().blockedTags.includes(tag)
    if (!wasBlocked) {
      set(s => ({ blockedTags: [...s.blockedTags, tag] }))
    }
    try {
      await blockApi.blockTag(tag)
    } catch {
      if (!wasBlocked) {
        set(s => ({ blockedTags: s.blockedTags.filter(t => t !== tag) }))
      }
      throw new Error('태그 차단에 실패했습니다.')
    }
  },

  unblockTag: async (tag) => {
    const wasBlocked = get().blockedTags.includes(tag)
    if (wasBlocked) {
      set(s => ({ blockedTags: s.blockedTags.filter(t => t !== tag) }))
    }
    try {
      await blockApi.unblockTag(tag)
    } catch {
      if (wasBlocked) {
        // 중복 추가 방지: 롤백 전 현재 배열에 없는 경우에만 재추가
        set(s => ({
          blockedTags: s.blockedTags.includes(tag)
            ? s.blockedTags
            : [...s.blockedTags, tag],
        }))
      }
      throw new Error('태그 차단 해제에 실패했습니다.')
    }
  },

  isUserBlocked: (userId) => get().blockedUserIds.includes(userId),
  isTagBlocked: (tag) => get().blockedTags.includes(tag),
}))
