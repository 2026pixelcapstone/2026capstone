import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import { chatApi, type ChatMessage, type ChatEvent } from '../api/chatApi'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'
import { useNotificationStore } from '../store/notificationStore'

interface Props {
  commissionId: number
  meId?: number
  readOnly?: boolean   // 종료(완료/취소)된 계약은 읽기 전용
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

const PAGE_SIZE = 30  // 한 번에 로드할 메시지 수 (백엔드 기본값과 일치)

// localStorage(zustand persist)에서 accessToken 추출 — axios 인터셉터와 동일 출처
function getToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage')
    return raw ? (JSON.parse(raw)?.state?.accessToken ?? null) : null
  } catch {
    return null
  }
}

// http(s)://host → ws(s)://host/ws
const WS_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/^http/, 'ws') + '/ws'

export default function CommissionChat({ commissionId, meId, readOnly = false }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)  // "위로 더보기" 진행 중
  const [hasMore, setHasMore] = useState(false)          // 더 이전 메시지 존재 여부
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [otherPresent, setOtherPresent] = useState(false)  // 상대가 지금 거래룸을 보고 있는지
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)             // 스크롤 컨테이너
  const lastIdRef = useRef<number | null>(null)            // 마지막 메시지 id (바닥 스크롤 판정용)
  const pendingPrependRef = useRef<number | null>(null)    // prepend 직전 scrollHeight (위치 보존용)

  // presence 목록(현재 방 접속자)에서 "나 말고 누가 있는지" 계산
  const applyPresence = useCallback((ids: number[]) => {
    if (meId == null) { setOtherPresent(false); return }  // meId 없으면 오탐지 방지
    setOtherPresent(ids.some(id => id !== meId))
  }, [meId])

  // 중복 방지 append — REST 응답 + WS 브로드캐스트로 같은 메시지가 두 번 올 수 있음
  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => prev.some(m => m.messageId === msg.messageId) ? prev : [...prev, msg])
  }, [])

  // 상대 메시지를 읽음 처리(서버) — 내가 보고 있을 때 호출. 서버가 READ 이벤트를 상대에게 브로드캐스트
  // 읽음 처리 후 알림 종 배지(안읽은 채팅 포함)도 즉시 갱신 (폴링 60초를 기다리지 않도록)
  const markRead = useCallback(() => {
    chatApi.markRead(commissionId)
      .then(() => useNotificationStore.getState().fetchUnread())
      .catch(() => { /* 읽음 처리 실패는 조용히 무시 */ })
  }, [commissionId])

  // 상대가 내 메시지를 읽음(READ 이벤트 수신) → 커서(lastId) 이하의 내 메시지만 읽음 표시
  // (전체를 읽음 처리하면, 읽음 처리 직후 보낸 메시지까지 오표시되는 동시성 문제 발생)
  const markMineReadUpTo = useCallback((lastId: number) => {
    setMessages(prev => prev.map(m =>
      (m.senderId === meId && m.messageId <= lastId && !m.isRead ? { ...m, isRead: true } : m)))
  }, [meId])

  // 최신 PAGE_SIZE개 로드 (showSpinner=false면 재동기화용 조용한 로드)
  // 통째 교체가 아니라 병합 — 이미 로드한 이전 메시지 + 재동기화 중 WS로 도착한 메시지가 유실되지 않도록.
  // updateHasMore=true(초기)일 때만 hasMore 반영(재동기화는 기존 로드분을 깎지 않도록 유지).
  const loadLatest = useCallback((showSpinner: boolean, updateHasMore: boolean) => {
    if (showSpinner) setLoading(true)
    chatApi.getMessages(commissionId, { size: PAGE_SIZE })
      .then(res => {
        const { messages: fetched, hasMore: more } = res.data.data
        if (updateHasMore) setHasMore(more)
        setMessages(prev => {
          const fetchedIds = new Set(fetched.map(m => m.messageId))
          const kept = prev.filter(m => !fetchedIds.has(m.messageId))
          return [...kept, ...fetched].sort((a, b) => a.messageId - b.messageId)
        })
      })
      .catch(() => { if (showSpinner) toast.error('메시지를 불러오지 못했습니다.') })
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [commissionId])

  // "위로 더보기" — 현재 가장 오래된 메시지보다 이전 PAGE_SIZE개를 앞에 붙임(prepend).
  // prepend 직전 scrollHeight를 기록해 두면 useLayoutEffect가 스크롤 위치를 보존(화면 점프 방지).
  const loadMore = useCallback(() => {
    if (loadingMore || messages.length === 0) return
    setLoadingMore(true)
    const before = messages[0].messageId
    pendingPrependRef.current = listRef.current?.scrollHeight ?? 0
    chatApi.getMessages(commissionId, { before, size: PAGE_SIZE })
      .then(res => {
        const { messages: older, hasMore: more } = res.data.data
        setHasMore(more)
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.messageId))
          return [...older.filter(m => !ids.has(m.messageId)), ...prev]
            .sort((a, b) => a.messageId - b.messageId)
        })
      })
      .catch(() => { pendingPrependRef.current = null; toast.error('이전 메시지를 불러오지 못했습니다.') })
      .finally(() => setLoadingMore(false))
  }, [commissionId, loadingMore, messages])

  // 진입 시 초기 로드(최신 PAGE_SIZE개) + 상대 메시지 읽음 처리
  useEffect(() => {
    loadLatest(true, true)
    markRead()
  }, [loadLatest, markRead])

  // WebSocket(STOMP) 실시간 수신 — 연결되면 재동기화 + 토픽 구독
  useEffect(() => {
    const token = getToken()
    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 4000,
      onConnect: () => {
        loadLatest(false, false)   // 재연결 시 놓친 최신 메시지 동기화 (스피너 없이, 기존 로드분 유지)
        markRead()            // 끊긴 사이 온 메시지도 읽음 처리
        // 입장 직후 현재 접속자 스냅샷 (입장 브로드캐스트를 놓칠 수 있는 race 대비)
        chatApi.getPresence(commissionId).then(res => applyPresence(res.data.data)).catch(() => {})
        client.subscribe(`/topic/commissions/${commissionId}`, frame => {
          try {
            const event = JSON.parse(frame.body) as ChatEvent
            if (event.type === 'MESSAGE' && event.message) {
              appendMessage(event.message)
              // 내가 보고 있는 중 상대 메시지가 오면 즉시 읽음 처리 → 상대에게 "읽음" 전파
              if (event.message.senderId !== meId) markRead()
            } else if (event.type === 'READ') {
              // 상대가 내 메시지를 (커서 이하까지) 읽음
              if (event.readerId !== meId && event.lastReadMessageId != null) {
                markMineReadUpTo(event.lastReadMessageId)
              }
            } else if (event.type === 'PRESENCE') {
              // 입퇴장 → 현재 접속자 갱신
              applyPresence(event.presentUserIds ?? [])
            }
          } catch { /* 파싱 실패 무시 */ }
        })
      },
      onStompError: frame => {
        // 서버가 거부(인증·구독 권한 등) 시 STOMP ERROR 프레임
        console.error('[chat] STOMP error:', frame.headers['message'], frame.body)
      },
      onWebSocketError: err => {
        // 연결 자체 실패 (핸드셰이크·네트워크)
        console.error('[chat] WebSocket error:', err)
      },
    })
    client.activate()
    return () => { client.deactivate() }
  }, [commissionId, loadLatest, appendMessage, markRead, markMineReadUpTo, applyPresence, meId])

  // prepend(위로 더보기) 직후 스크롤 위치 보존 — 페인트 전에 보정해 점프 방지
  useLayoutEffect(() => {
    if (pendingPrependRef.current != null && listRef.current) {
      const el = listRef.current
      el.scrollTop += el.scrollHeight - pendingPrependRef.current
      pendingPrependRef.current = null
    }
  }, [messages])

  // 마지막 메시지가 바뀔 때(새 메시지 추가/초기 로드)만 맨 아래로 스크롤.
  // 위로 더보기(prepend)는 마지막 메시지가 그대로라 바닥으로 튕기지 않음.
  useEffect(() => {
    const lastId = messages.length ? messages[messages.length - 1].messageId : null
    if (lastId !== lastIdRef.current) {
      lastIdRef.current = lastId
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const res = await chatApi.sendMessage(commissionId, content)
      appendMessage(res.data.data)
      setInput('')
    } catch (err) {
      toast.error(getErrorMessage(err, '메시지 전송에 실패했습니다.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border flex flex-col" style={{ background: '#161b22', borderColor: '#30363d', height: 480 }}>
      {/* 헤더 */}
      <div className="px-5 py-3 border-b flex items-center gap-2 flex-shrink-0" style={{ borderColor: '#30363d' }}>
        <span className="material-symbols-outlined text-base" style={{ color: '#2f81f7' }}>chat</span>
        <span className="font-bold text-sm">채팅</span>
        {otherPresent && (
          <span className="ml-auto flex items-center gap-1 text-xs font-bold" style={{ color: '#3fb950' }}>
            <span style={{ fontSize: 8 }}>●</span> 대화 중
          </span>
        )}
      </div>

      {/* 메시지 목록 */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full w-6 h-6 border-2" style={{ borderColor: '#2f81f7', borderTopColor: 'transparent' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="material-symbols-outlined text-3xl" style={{ color: '#30363d' }}>forum</span>
            <p className="text-sm" style={{ color: '#7d8590' }}>아직 메시지가 없습니다.</p>
            <p className="text-xs" style={{ color: '#484f58' }}>먼저 인사를 건네보세요.</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-1">
                <button type="button" onClick={loadMore} disabled={loadingMore}
                  className="text-xs px-3 py-1 rounded-full hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
                  {loadingMore ? '불러오는 중…' : '이전 메시지 더보기'}
                </button>
              </div>
            )}
            {messages.map(m => {
            const mine = m.senderId === meId
            return (
              <div key={m.messageId} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && (
                    <span className="text-xs mb-0.5" style={{ color: '#7d8590' }}>
                      {m.senderNickname ?? '상대'}
                    </span>
                  )}
                  <div className="px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                    style={mine
                      ? { background: '#2f81f7', color: '#fff', borderTopRightRadius: 4 }
                      : { background: '#21262d', color: '#e6edf3', borderTopLeftRadius: 4 }}>
                    {m.content}
                  </div>
                  <span className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#484f58' }}>
                    {mine && m.isRead && <span style={{ color: '#2f81f7' }}>읽음</span>}
                    {formatTime(m.createdAt)}
                  </span>
                </div>
              </div>
            )
          })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      {readOnly ? (
        <div className="px-5 py-3 border-t text-center text-sm flex-shrink-0"
          style={{ borderColor: '#30363d', color: '#7d8590' }}>
          종료된 거래입니다. 대화 기록은 열람만 가능합니다.
        </div>
      ) : (
        <form onSubmit={handleSend} className="px-3 py-3 border-t flex items-center gap-2 flex-shrink-0" style={{ borderColor: '#30363d' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="메시지를 입력하세요"
            maxLength={2000}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
          />
          <button type="submit" disabled={sending || !input.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:opacity-90 disabled:opacity-40 flex-shrink-0"
            style={{ background: '#2f81f7', color: '#fff' }}>
            <span className="material-symbols-outlined text-base">send</span>
          </button>
        </form>
      )}
    </div>
  )
}
