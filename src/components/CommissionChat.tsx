import { useState, useEffect, useRef, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import { chatApi, type ChatMessage, type ChatEvent } from '../api/chatApi'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'

interface Props {
  commissionId: number
  meId?: number
  readOnly?: boolean   // 종료(완료/취소)된 계약은 읽기 전용
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

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
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 중복 방지 append — REST 응답 + WS 브로드캐스트로 같은 메시지가 두 번 올 수 있음
  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => prev.some(m => m.messageId === msg.messageId) ? prev : [...prev, msg])
  }, [])

  // 상대 메시지를 읽음 처리(서버) — 내가 보고 있을 때 호출. 서버가 READ 이벤트를 상대에게 브로드캐스트
  const markRead = useCallback(() => {
    chatApi.markRead(commissionId).catch(() => { /* 읽음 처리 실패는 조용히 무시 */ })
  }, [commissionId])

  // 상대가 내 메시지를 읽음(READ 이벤트 수신) → 내가 보낸 메시지를 읽음 표시로 갱신
  const markMineRead = useCallback(() => {
    setMessages(prev => prev.map(m => (m.senderId === meId && !m.isRead ? { ...m, isRead: true } : m)))
  }, [meId])

  // 메시지 로드 (showSpinner=false면 재동기화용 조용한 로드)
  // 통째 교체가 아니라 병합 — 재동기화 fetch가 진행되는 사이 WS로 도착한 메시지가 유실되지 않도록
  const loadMessages = useCallback((showSpinner: boolean) => {
    if (showSpinner) setLoading(true)
    chatApi.getMessages(commissionId, { size: 100 })
      .then(res => {
        const fetched = res.data.data.content
        setMessages(prev => {
          const fetchedIds = new Set(fetched.map(m => m.messageId))
          const newFromWs = prev.filter(m => !fetchedIds.has(m.messageId))
          return [...fetched, ...newFromWs].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        })
      })
      .catch(() => { if (showSpinner) toast.error('메시지를 불러오지 못했습니다.') })
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [commissionId])

  // 진입 시 초기 로드 + 상대 메시지 읽음 처리
  useEffect(() => {
    loadMessages(true)
    markRead()
  }, [loadMessages, markRead])

  // WebSocket(STOMP) 실시간 수신 — 연결되면 재동기화 + 토픽 구독
  useEffect(() => {
    const token = getToken()
    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 4000,
      onConnect: () => {
        loadMessages(false)   // 재연결 시 놓친 메시지 동기화 (스피너 없이)
        markRead()            // 끊긴 사이 온 메시지도 읽음 처리
        client.subscribe(`/topic/commissions/${commissionId}`, frame => {
          try {
            const event = JSON.parse(frame.body) as ChatEvent
            if (event.type === 'MESSAGE' && event.message) {
              appendMessage(event.message)
              // 내가 보고 있는 중 상대 메시지가 오면 즉시 읽음 처리 → 상대에게 "읽음" 전파
              if (event.message.senderId !== meId) markRead()
            } else if (event.type === 'READ') {
              // 상대가 내 메시지를 읽음
              if (event.readerId !== meId) markMineRead()
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
  }, [commissionId, loadMessages, appendMessage, markRead, markMineRead, meId])

  // 메시지 갱신 시 맨 아래로 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
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
          messages.map(m => {
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
          })
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
