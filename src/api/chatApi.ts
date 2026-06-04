import api from '../lib/axios'
import type { PageResponse } from './galleryApi'

export interface ChatMessage {
  messageId: number
  senderId: number
  senderNickname: string | null
  senderProfileImageUrl: string | null
  content: string
  isRead: boolean
  createdAt: string
}

export const chatApi = {
  // 커미션 거래룸 메시지 목록 (시간 오름차순, 로그인·당사자 전용)
  getMessages: (commissionId: number, params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<ChatMessage> }>(
      `/api/commissions/${commissionId}/messages`, { params }),

  // 메시지 전송
  sendMessage: (commissionId: number, content: string) =>
    api.post<{ success: boolean; data: ChatMessage }>(
      `/api/commissions/${commissionId}/messages`, { content }),
}
