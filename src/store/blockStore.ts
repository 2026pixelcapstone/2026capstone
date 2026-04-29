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
    // 낙관적 업데이트
    set(s => ({
      blockedUserIds: s.blockedUserIds.includes(userId)
        ? s.blockedUserIds
        : [...s.blockedUserIds, userId],
    }))
    try {
      await blockApi.blockUser(userId)
    } catch {
      // 실패 시 롤백
      set(s => ({ blockedUserIds: s.blockedUserIds.filter(id => id !== userId) }))
      throw new Error('차단에 실패했습니다.')
    }
  },

  unblockUser: async (userId) => {
    set(s => ({ blockedUserIds: s.blockedUserIds.filter(id => id !== userId) }))
    try {
      await blockApi.unblockUser(userId)
    } catch {
      // 실패 시 롤백
      set(s => ({
        blockedUserIds: s.blockedUserIds.includes(userId)
          ? s.blockedUserIds
          : [...s.blockedUserIds, userId],
      }))
      throw new Error('차단 해제에 실패했습니다.')
    }
  },

  blockTag: async (tag) => {
    set(s => ({
      blockedTags: s.blockedTags.includes(tag) ? s.blockedTags : [...s.blockedTags, tag],
    }))
    try {
      await blockApi.blockTag(tag)
    } catch {
      set(s => ({ blockedTags: s.blockedTags.filter(t => t !== tag) }))
      throw new Error('태그 차단에 실패했습니다.')
    }
  },

  unblockTag: async (tag) => {
    set(s => ({ blockedTags: s.blockedTags.filter(t => t !== tag) }))
    try {
      await blockApi.unblockTag(tag)
    } catch {
      set(s => ({
        blockedTags: s.blockedTags.includes(tag) ? s.blockedTags : [...s.blockedTags, tag],
      }))
      throw new Error('태그 차단 해제에 실패했습니다.')
    }
  },

  isUserBlocked: (userId) => get().blockedUserIds.includes(userId),
  isTagBlocked: (tag) => get().blockedTags.includes(tag),
}))
