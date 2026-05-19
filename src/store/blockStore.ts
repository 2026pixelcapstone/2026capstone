import { create } from 'zustand'
import { blockApi, type BlockedUserInfo } from '../api/blockApi'
import { useAuthStore } from './authStore'

interface BlockState {
  /** 피드 필터링용 ID 배열 */
  blockedUserIds: number[]
  /** MyPage 표시용 — 닉네임/이미지 포함 */
  blockedUsers: BlockedUserInfo[]
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
  blockedUsers: [],
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
      const { blockedUsers, blockedTags } = res.data.data
      set({
        blockedUsers,
        blockedUserIds: blockedUsers.map(u => u.userId),
        blockedTags,
        loaded: true,
      })
    } catch {
      // 에러가 발생해도 같은 세션이면 loaded를 true로 설정해 차단 로직이 비활성화되지 않도록 함
      const { isLoggedIn, accessToken } = useAuthStore.getState()
      if (isLoggedIn && accessToken === tokenAtRequest) {
        set({ loaded: true })
      }
    }
  },

  clearBlocks: () => set({ blockedUserIds: [], blockedUsers: [], blockedTags: [], loaded: false }),

  blockUser: async (userId) => {
    // 낙관적 업데이트: 피드 필터링(blockedUserIds)만 즉시 반영
    const wasBlocked = get().blockedUserIds.includes(userId)
    if (!wasBlocked) {
      set(s => ({ blockedUserIds: [...s.blockedUserIds, userId] }))
    }
    try {
      await blockApi.blockUser(userId)
      // 성공 시 서버에서 닉네임/이미지 포함한 전체 목록 갱신
      await get().fetchBlocks()
    } catch (err) {
      if (!wasBlocked) {
        set(s => ({ blockedUserIds: s.blockedUserIds.filter(id => id !== userId) }))
      }
      throw err instanceof Error ? err : new Error('차단에 실패했습니다.')
    }
  },

  unblockUser: async (userId) => {
    const wasBlocked = get().blockedUserIds.includes(userId)
    // 롤백을 위해 제거 전 유저 정보 보존
    const removedUser = get().blockedUsers.find(u => u.userId === userId)
    if (wasBlocked) {
      set(s => ({
        blockedUserIds: s.blockedUserIds.filter(id => id !== userId),
        blockedUsers: s.blockedUsers.filter(u => u.userId !== userId),
      }))
    }
    try {
      await blockApi.unblockUser(userId)
    } catch (err) {
      if (wasBlocked) {
        // 롤백: 제거 전 상태로 복원
        set(s => ({
          blockedUserIds: s.blockedUserIds.includes(userId)
            ? s.blockedUserIds
            : [...s.blockedUserIds, userId],
          blockedUsers: removedUser && !s.blockedUsers.find(u => u.userId === userId)
            ? [...s.blockedUsers, removedUser]
            : s.blockedUsers,
        }))
      }
      throw err instanceof Error ? err : new Error('차단 해제에 실패했습니다.')
    }
  },

  blockTag: async (tag) => {
    const wasBlocked = get().blockedTags.includes(tag)
    if (!wasBlocked) {
      set(s => ({ blockedTags: [...s.blockedTags, tag] }))
    }
    try {
      await blockApi.blockTag(tag)
    } catch (err) {
      if (!wasBlocked) {
        set(s => ({ blockedTags: s.blockedTags.filter(t => t !== tag) }))
      }
      throw err instanceof Error ? err : new Error('태그 차단에 실패했습니다.')
    }
  },

  unblockTag: async (tag) => {
    const wasBlocked = get().blockedTags.includes(tag)
    if (wasBlocked) {
      set(s => ({ blockedTags: s.blockedTags.filter(t => t !== tag) }))
    }
    try {
      await blockApi.unblockTag(tag)
    } catch (err) {
      if (wasBlocked) {
        set(s => ({
          blockedTags: s.blockedTags.includes(tag)
            ? s.blockedTags
            : [...s.blockedTags, tag],
        }))
      }
      throw err instanceof Error ? err : new Error('태그 차단 해제에 실패했습니다.')
    }
  },

  isUserBlocked: (userId) => get().blockedUserIds.includes(userId),
  isTagBlocked: (tag) => get().blockedTags.includes(tag),
}))
