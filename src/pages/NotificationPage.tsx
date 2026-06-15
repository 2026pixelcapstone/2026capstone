import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationApi, type NotificationItem } from '../api/notificationApi'
import { useNotificationStore } from '../store/notificationStore'
import { notificationTargetPath, notificationIcon, timeAgo } from '../utils/notificationUtils'

const PAGE_SIZE = 20

export default function NotificationPage() {
  const navigate = useNavigate()
  const { fetchUnread } = useNotificationStore()

  const [items, setItems] = useState<NotificationItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadedRef = useRef(false) // StrictMode 이중 호출 가드

  const loadInitial = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationApi.getList({ size: PAGE_SIZE })
      setItems(res.data.data.notifications)
      setHasMore(res.data.data.hasMore)
    } catch {
      setItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length === 0) return
    setLoadingMore(true)
    try {
      const before = items[items.length - 1].notificationId
      const res = await notificationApi.getList({ before, size: PAGE_SIZE })
      setItems(prev => [...prev, ...res.data.data.notifications])
      setHasMore(res.data.data.hasMore)
    } catch {
      /* 무시 — 버튼 다시 시도 가능 */
    } finally {
      setLoadingMore(false)
    }
  }, [items, loadingMore])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void loadInitial()
  }, [loadInitial])

  const handleClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      try {
        await notificationApi.markRead(n.notificationId)
        setItems(prev => prev.map(x => x.notificationId === n.notificationId ? { ...x, isRead: true } : x))
        await fetchUnread()
      } catch { /* 베스트 에포트 */ }
    }
    const path = notificationTargetPath(n)
    if (path) navigate(path)
  }

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllRead()
      setItems(prev => prev.map(n => ({ ...n, isRead: true })))
      await fetchUnread()
    } catch { /* 무시 */ }
  }

  return (
    <div className="max-w-[760px] mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#e6edf3' }}>알림</h1>
        {items.some(n => !n.isRead) && (
          <button onClick={handleMarkAll}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-[#1c2128]"
            style={{ color: '#7d8590' }}>
            모두 읽음
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm" style={{ color: '#7d8590' }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center" style={{ color: '#7d8590' }}>
          <span className="material-symbols-outlined text-5xl block mb-3" style={{ color: '#30363d' }}>
            notifications_off
          </span>
          <p className="text-sm">아직 알림이 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#21262d' }}>
          {items.map(n => (
            <button key={n.notificationId} onClick={() => handleClick(n)}
              className="w-full flex items-start gap-3 px-4 py-4 border-b transition-colors hover:bg-[#1c2128] text-left"
              style={{ borderColor: '#21262d', background: n.isRead ? 'transparent' : 'rgba(47,129,247,0.06)' }}>
              {n.senderProfileImageUrl ? (
                <img src={n.senderProfileImageUrl} alt=""
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#21262d' }}>
                  <span className="material-symbols-outlined text-xl" style={{ color: '#7d8590' }}>
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
          ))}

          {hasMore && (
            <button onClick={loadMore} disabled={loadingMore}
              className="w-full py-3 text-sm font-semibold transition-colors hover:bg-[#1c2128] disabled:opacity-50"
              style={{ color: '#7d8590' }}>
              {loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
