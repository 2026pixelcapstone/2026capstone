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
    try {
      const res = await blockApi.getMyBlocks()
      // 응답 도착 시점에 여전히 로그인 상태인지 확인 (로그아웃 후 늦은 응답 방지)
      if (!useAuthStore.getState().isLoggedIn) return
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
    // 호출 전 상태 스냅샷 → 실패 시 정확히 이 상태로 복원
    const prev = get().blockedUserIds
    set(s => ({
      blockedUserIds: s.blockedUserIds.includes(userId)
        ? s.blockedUserIds
        : [...s.blockedUserIds, userId],
    }))
    try {
      await blockApi.blockUser(userId)
    } catch {
      set({ blockedUserIds: prev })
      throw new Error('차단에 실패했습니다.')
    }
  },

  unblockUser: async (userId) => {
    const prev = get().blockedUserIds
    set(s => ({ blockedUserIds: s.blockedUserIds.filter(id => id !== userId) }))
    try {
      await blockApi.unblockUser(userId)
    } catch {
      set({ blockedUserIds: prev })
      throw new Error('차단 해제에 실패했습니다.')
    }
  },

  blockTag: async (tag) => {
    const prev = get().blockedTags
    set(s => ({
      blockedTags: s.blockedTags.includes(tag) ? s.blockedTags : [...s.blockedTags, tag],
    }))
    try {
      await blockApi.blockTag(tag)
    } catch {
      set({ blockedTags: prev })
      throw new Error('태그 차단에 실패했습니다.')
    }
  },

  unblockTag: async (tag) => {
    const prev = get().blockedTags
    set(s => ({ blockedTags: s.blockedTags.filter(t => t !== tag) }))
    try {
      await blockApi.unblockTag(tag)
    } catch {
      set({ blockedTags: prev })
      throw new Error('태그 차단 해제에 실패했습니다.')
    }
  },

  isUserBlocked: (userId) => get().blockedUserIds.includes(userId),
  isTagBlocked: (tag) => get().blockedTags.includes(tag),
}))
