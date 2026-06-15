import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationApi, type NotificationItem } from '../api/notificationApi'
import { useNotificationStore } from '../store/notificationStore'
import { notificationTargetPath, notificationIcon, timeAgo } from '../utils/notificationUtils'

const DROPDOWN_SIZE = 8

export default function NotificationBell() {
  const navigate = useNavigate()
  const { unreadTotal, unreadChat, fetchUnread } = useNotificationStore()

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 드롭다운 열 때 최근 알림 로드
  useEffect(() => {
    if (!open) return
    setLoading(true)
    notificationApi.getList({ size: DROPDOWN_SIZE })
      .then(res => setItems(res.data.data.notifications))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open])

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const badge = unreadTotal > 99 ? '99+' : String(unreadTotal)

  const handleItemClick = async (n: NotificationItem) => {
    setOpen(false)
    if (!n.isRead) {
      try {
        await notificationApi.markRead(n.notificationId)
        await fetchUnread()
      } catch { /* 베스트 에포트 — 실패해도 이동은 진행 */ }
    }
    const path = notificationTargetPath(n)
    if (path) navigate(path)
  }

  const handleChatSummaryClick = () => {
    setOpen(false)
    navigate('/commission')
  }

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllRead()
      setItems(prev => prev.map(n => ({ ...n, isRead: true })))
      await fetchUnread()
    } catch { /* 무시 */ }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 rounded-lg transition-all hover:bg-[#1c2128]"
        style={{ color: '#7d8590' }}
        title="알림">
        <span className="material-symbols-outlined text-2xl">notifications</span>
        {unreadTotal > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: '#f85149', color: '#fff' }}>
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 rounded-xl border overflow-hidden shadow-2xl z-50"
          style={{ background: '#161b22', borderColor: '#30363d', width: 360 }}>

          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#21262d' }}>
            <span className="text-sm font-bold" style={{ color: '#e6edf3' }}>알림</span>
            <button onClick={handleMarkAll}
              className="text-xs font-semibold hover:underline" style={{ color: '#7d8590' }}>
              모두 읽음
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {/* 채팅 안읽음 요약 한 줄 */}
            {unreadChat > 0 && (
              <button onClick={handleChatSummaryClick}
                className="w-full flex items-center gap-3 px-4 py-3 border-b transition-colors hover:bg-[#1c2128] text-left"
                style={{ borderColor: '#21262d' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: '#2f81f7' }}>forum</span>
                <span className="text-sm font-semibold flex-1" style={{ color: '#e6edf3' }}>
                  읽지 않은 메시지 {unreadChat}개
                </span>
                <span className="material-symbols-outlined text-base" style={{ color: '#7d8590' }}>chevron_right</span>
              </button>
            )}

            {/* 알림 목록 */}
            {loading ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#7d8590' }}>불러오는 중…</div>
            ) : items.length === 0 ? (
              unreadChat > 0 ? null : (
                <div className="px-4 py-10 text-center text-sm" style={{ color: '#7d8590' }}>
                  새로운 알림이 없습니다.
                </div>
              )
            ) : (
              items.map(n => (
                <button key={n.notificationId} onClick={() => handleItemClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 border-b transition-colors hover:bg-[#1c2128] text-left"
                  style={{ borderColor: '#21262d', background: n.isRead ? 'transparent' : 'rgba(47,129,247,0.06)' }}>
                  {n.senderProfileImageUrl ? (
                    <img src={n.senderProfileImageUrl} alt=""
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: '#21262d' }}>
                      <span className="material-symbols-outlined text-lg" style={{ color: '#7d8590' }}>
                        {notificationIcon(n.type)}
                      </span>
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm leading-snug" style={{ color: '#e6edf3' }}>{n.title}</span>
                    <span className="block text-xs mt-1" style={{ color: '#7d8590' }}>{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#2f81f7' }} />
                  )}
                </button>
              ))
            )}
          </div>

          {/* 푸터 */}
          <button onClick={() => { setOpen(false); navigate('/notifications') }}
            className="w-full px-4 py-3 text-sm font-semibold border-t transition-colors hover:bg-[#1c2128]"
            style={{ borderColor: '#21262d', color: '#2f81f7' }}>
            전체 보기
          </button>
        </div>
      )}
    </div>
  )
}
