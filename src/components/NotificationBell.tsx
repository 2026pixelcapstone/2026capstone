import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationApi, type NotificationItem } from '../api/notificationApi'
import { chatApi, type UnreadConversation } from '../api/chatApi'
import { useNotificationStore } from '../store/notificationStore'
import { notificationTargetPath, notificationIcon, timeAgo } from '../utils/notificationUtils'
import ChatPreviewRow from './ChatPreviewRow'

const DROPDOWN_SIZE = 8

export default function NotificationBell() {
  const navigate = useNavigate()
  const { unreadTotal, fetchUnread } = useNotificationStore()

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [convs, setConvs] = useState<UnreadConversation[]>([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 드롭다운 열 때 안읽은 알림 + 안읽은 대화방을 함께 로드
  // (재오픈 시 이전 요청의 늦은 응답이 덮어쓰지 않도록 가드)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      notificationApi.getList({ size: DROPDOWN_SIZE, unreadOnly: true }),
      chatApi.getUnreadConversations(),
    ])
      .then(([notiRes, convRes]) => {
        if (cancelled) return
        setItems(notiRes.data.data.notifications)
        setConvs(convRes.data.data)
      })
      .catch(() => { if (!cancelled) { setItems([]); setConvs([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
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
      // 드롭다운은 안읽음만 표시하므로 읽은 항목은 목록에서 제거
      setItems(prev => prev.filter(x => x.notificationId !== n.notificationId))
      try {
        await notificationApi.markRead(n.notificationId)
        await fetchUnread()
      } catch { /* 베스트 에포트 — 실패해도 이동은 진행 */ }
    }
    const path = notificationTargetPath(n)
    if (path) navigate(path)
  }

  const handleConvClick = (commissionId: number) => {
    setOpen(false)
    navigate(`/commission/${commissionId}`)
  }

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllRead()
      setItems([])   // 드롭다운은 안읽음만 표시 → 전부 읽으면 비움
      await fetchUnread()
    } catch { /* 무시 */ }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 rounded-lg transition-all hover:bg-surface-container-low"
        style={{ color: 'var(--color-on-surface-variant)' }}
        title="알림">
        <span className="material-symbols-outlined text-2xl">notifications</span>
        {unreadTotal > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: 'var(--color-error)', color: '#fff' }}>
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 rounded-xl border overflow-hidden shadow-2xl z-50"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)', width: 360 }}>

          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-surface-container)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>알림</span>
            <button onClick={handleMarkAll}
              className="text-xs font-semibold hover:underline" style={{ color: 'var(--color-on-surface-variant)' }}>
              모두 읽음
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {/* 안읽은 대화방 미리보기 (최신 메시지순) → 클릭 시 해당 거래룸으로 */}
            {convs.map(c => (
              <ChatPreviewRow key={c.commissionId} conv={c}
                onClick={() => handleConvClick(c.commissionId)} />
            ))}

            {/* 알림 목록 */}
            {loading ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>불러오는 중…</div>
            ) : items.length === 0 ? (
              convs.length > 0 ? null : (
                <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  새로운 알림이 없습니다.
                </div>
              )
            ) : (
              items.map(n => (
                <button key={n.notificationId} onClick={() => handleItemClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 border-b transition-colors hover:bg-surface-container-low text-left"
                  style={{ borderColor: 'var(--color-surface-container)', background: n.isRead ? 'transparent' : 'color-mix(in srgb, var(--color-primary) 6%, transparent)' }}>
                  {n.senderProfileImageUrl ? (
                    <img src={n.senderProfileImageUrl} alt=""
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--color-surface-container)' }}>
                      <span className="material-symbols-outlined text-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {notificationIcon(n.type)}
                      </span>
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm leading-snug" style={{ color: 'var(--color-on-surface)' }}>{n.title}</span>
                    <span className="block text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: 'var(--color-primary)' }} />
                  )}
                </button>
              ))
            )}
          </div>

          {/* 푸터 */}
          <button onClick={() => { setOpen(false); navigate('/notifications') }}
            className="w-full px-4 py-3 text-sm font-semibold border-t transition-colors hover:bg-surface-container-low"
            style={{ borderColor: 'var(--color-surface-container)', color: 'var(--color-primary)' }}>
            전체 보기
          </button>
        </div>
      )}
    </div>
  )
}
