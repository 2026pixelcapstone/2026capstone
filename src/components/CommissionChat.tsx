import { useState, useEffect, useRef } from 'react'
import { chatApi, type ChatMessage } from '../api/chatApi'
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

export default function CommissionChat({ commissionId, meId, readOnly = false }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 진입 시 메시지 로드 (방은 백엔드에서 지연 생성됨)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    chatApi.getMessages(commissionId, { size: 100 })
      .then(res => { if (!cancelled) setMessages(res.data.data.content) })
      .catch(() => { if (!cancelled) toast.error('메시지를 불러오지 못했습니다.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [commissionId])

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
      setMessages(prev => [...prev, res.data.data])
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
            <div className="animate-spin rounded-full w-6 h-6 border-2 border-t-transparent" style={{ borderColor: '#2f81f7' }} />
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
                  <span className="text-xs mt-0.5" style={{ color: '#484f58' }}>{formatTime(m.createdAt)}</span>
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
