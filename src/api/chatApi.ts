import api from '../lib/axios'

export interface ChatMessage {
  messageId: number
  senderId: number
  senderNickname: string | null
  senderProfileImageUrl: string | null
  content: string
  isRead: boolean
  createdAt: string
}

// 커서 페이지네이션 응답 — messages는 오름차순(오래된→최신), hasMore=더 이전 메시지 존재 여부
export interface ChatMessagePage {
  messages: ChatMessage[]
  hasMore: boolean
}

// WebSocket 토픽으로 오는 이벤트 봉투 (type으로 분기)
export interface ChatEvent {
  type: 'MESSAGE' | 'READ' | 'PRESENCE'
  message?: ChatMessage      // type=MESSAGE
  readerId?: number          // type=READ — 상대 메시지를 읽은 사용자
  lastReadMessageId?: number // type=READ — 이 messageId 이하만 읽음으로 간주
  presentUserIds?: number[]  // type=PRESENCE — 현재 거래룸에 있는 사용자들
}

export const chatApi = {
  // 커미션 거래룸 메시지 목록 (커서 페이지네이션, 로그인·당사자 전용)
  // before 없으면 최신 size개, before=messageId면 그보다 이전 size개("위로 더보기")
  getMessages: (commissionId: number, params?: { before?: number; size?: number }) =>
    api.get<{ success: boolean; data: ChatMessagePage }>(
      `/api/commissions/${commissionId}/messages`, { params }),

  // 메시지 전송
  sendMessage: (commissionId: number, content: string) =>
    api.post<{ success: boolean; data: ChatMessage }>(
      `/api/commissions/${commissionId}/messages`, { content }),

  // 읽음 처리 (상대 메시지를 읽음으로)
  markRead: (commissionId: number) =>
    api.post<{ success: boolean }>(`/api/commissions/${commissionId}/messages/read`),

  // 현재 거래룸 접속자 스냅샷 (입장 직후 초기 presence)
  getPresence: (commissionId: number) =>
    api.get<{ success: boolean; data: number[] }>(`/api/commissions/${commissionId}/presence`),
}
