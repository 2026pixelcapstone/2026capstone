import type { NotificationItem } from '../api/notificationApi'

/** 알림 클릭 시 이동할 경로. 대상 정보가 부족하면 null(이동 안 함). */
export function notificationTargetPath(n: NotificationItem): string | null {
  switch (n.targetType) {
    case 'GALLERY':
      return n.targetId != null ? `/gallery/${n.targetId}` : null
    case 'ASSET':
      return n.targetId != null ? `/assets/${n.targetId}` : null
    case 'USER':
      // 프로필 라우트는 닉네임 기반(/profile/:username)
      return n.senderNickname ? `/profile/${encodeURIComponent(n.senderNickname)}` : null
    case 'COMMISSION':
      return n.targetId != null ? `/commission/${n.targetId}` : null
    case 'REQUEST_POST':
      return n.targetId != null ? `/request-posts/${n.targetId}` : null
    default:
      return null
  }
}

/** 알림 종류별 머티리얼 아이콘명 */
export function notificationIcon(type: NotificationItem['type']): string {
  switch (type) {
    case 'GALLERY_COMMENT':
    case 'ASSET_COMMENT':
      return 'chat_bubble'
    case 'FOLLOW':
      return 'person_add'
    case 'COMMISSION_APPLY':
      return 'how_to_reg'
    case 'COMMISSION_ACCEPT':
      return 'handshake'
    case 'COMMISSION_REVIEW':
      return 'rate_review'
    case 'COMMISSION_COMPLETED':
      return 'task_alt'
    case 'COMMISSION_CANCELLED':
      return 'cancel'
    default:
      return 'notifications'
  }
}

/** "방금 전 / N분 전 / N시간 전 / N일 전 / YYYY.MM.DD" 상대 시간 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diffSec = Math.floor((Date.now() - then) / 1000)

  if (diffSec < 60) return '방금 전'
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}일 전`

  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
