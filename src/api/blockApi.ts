import api from '../lib/axios'

export interface BlockResponse {
  blockedUserIds: number[]
  blockedTags: string[]
}

export const blockApi = {
  /** 내 차단 목록 전체 조회 */
  getMyBlocks: () =>
    api.get<{ success: boolean; data: BlockResponse }>('/api/blocks'),

  /** 사용자 차단 */
  blockUser: (targetUserId: number) =>
    api.post<{ success: boolean }>(`/api/blocks/users/${targetUserId}`),

  /** 사용자 차단 해제 */
  unblockUser: (targetUserId: number) =>
    api.delete<{ success: boolean }>(`/api/blocks/users/${targetUserId}`),

  /** 태그 차단 */
  blockTag: (tagName: string) =>
    api.post<{ success: boolean }>(`/api/blocks/tags/${encodeURIComponent(tagName)}`),

  /** 태그 차단 해제 */
  unblockTag: (tagName: string) =>
    api.delete<{ success: boolean }>(`/api/blocks/tags/${encodeURIComponent(tagName)}`),
}
