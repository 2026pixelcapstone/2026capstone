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

// WebSocket 토픽으로 오는 이벤트 봉투 (type으로 분기). PRESENCE는 추후 추가.
export interface ChatEvent {
  type: 'MESSAGE' | 'READ' | 'PRESENCE'
  message?: ChatMessage      // type=MESSAGE
  readerId?: number          // type=READ — 상대 메시지를 읽은 사용자
  lastReadMessageId?: number // type=READ — 이 messageId 이하만 읽음으로 간주
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

  // 읽음 처리 (상대 메시지를 읽음으로)
  markRead: (commissionId: number) =>
    api.post<{ success: boolean }>(`/api/commissions/${commissionId}/messages/read`),
}
