import api from '../lib/axios'

// 알림 종류 — 백엔드 NotificationType.name()과 1:1
export type NotificationType =
  | 'GALLERY_COMMENT'
  | 'ASSET_COMMENT'
  | 'FOLLOW'
  | 'COMMISSION_APPLY'
  | 'COMMISSION_ACCEPT'
  | 'COMMISSION_REVIEW'
  | 'COMMISSION_COMPLETED'
  | 'COMMISSION_CANCELLED'

// 클릭 시 이동 분기 키 — 백엔드 NotificationType.targetType
export type NotificationTargetType =
  | 'GALLERY'
  | 'ASSET'
  | 'USER'
  | 'COMMISSION'
  | 'REQUEST_POST'

export interface NotificationItem {
  notificationId: number
  type: NotificationType
  title: string
  targetType: NotificationTargetType | null
  targetId: number | null
  isRead: boolean
  senderId: number | null
  senderNickname: string | null
  senderProfileImageUrl: string | null
  createdAt: string
}

// 커서 페이지네이션 응답 — notifications는 최신순, hasMore=더 과거 알림 존재 여부
export interface NotificationPage {
  notifications: NotificationItem[]
  hasMore: boolean
}

// 안읽음 집계 — total = notifications + chat
export interface UnreadCount {
  notifications: number
  chat: number
  total: number
}

export const notificationApi = {
  // 목록 (커서 — before 없으면 최신 size개, before=notificationId면 그보다 이전 size개)
  // unreadOnly=true면 안읽음만 (드롭다운용), 미지정/false면 전체 (전체보기 페이지용)
  getList: (params?: { before?: number; size?: number; unreadOnly?: boolean }) =>
    api.get<{ success: boolean; data: NotificationPage }>('/api/notifications', { params }),

  // 안읽음 집계 (종 배지 폴링 대상)
  getUnreadCount: () =>
    api.get<{ success: boolean; data: UnreadCount }>('/api/notifications/unread-count'),

  // 단건 읽음
  markRead: (notificationId: number) =>
    api.post<{ success: boolean }>(`/api/notifications/${notificationId}/read`),

  // 전체 읽음 (알림만 — 채팅은 채팅방 입장 시 차감)
  markAllRead: () =>
    api.post<{ success: boolean }>('/api/notifications/read-all'),
}
