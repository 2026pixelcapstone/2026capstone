import type { UnreadConversation } from '../api/chatApi'
import { timeAgo } from '../utils/notificationUtils'

/** 알림 드롭다운/전체보기에서 쓰는 안읽은 대화방 미리보기 한 줄 (클릭 시 해당 거래룸으로). */
export default function ChatPreviewRow({
  conv,
  onClick,
}: {
  conv: UnreadConversation
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 border-b transition-colors hover:bg-[#1c2128] text-left"
      style={{ borderColor: '#21262d', background: 'rgba(47,129,247,0.06)' }}>
      {conv.partnerProfileImageUrl ? (
        <img src={conv.partnerProfileImageUrl}
          alt={conv.partnerNickname ? `${conv.partnerNickname} 프로필 이미지` : '사용자 프로필 이미지'}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
      ) : (
        <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#21262d' }}>
          <span className="material-symbols-outlined text-lg" style={{ color: '#7d8590' }}>person</span>
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: '#e6edf3' }}>
            {conv.partnerNickname ?? '알 수 없음'}
          </span>
          {conv.lastMessageAt && (
            <span className="text-xs flex-shrink-0" style={{ color: '#7d8590' }}>{timeAgo(conv.lastMessageAt)}</span>
          )}
        </span>
        <span className="block text-xs mt-0.5 truncate" style={{ color: '#7d8590' }}>
          {conv.lastMessageContent ?? ''}
        </span>
      </span>
      <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0"
        style={{ background: '#f85149', color: '#fff' }}>
        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
      </span>
    </button>
  )
}
