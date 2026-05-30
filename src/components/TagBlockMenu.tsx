import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBlockStore } from '../store/blockStore'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'

interface TagBlockMenuProps {
  /** 이 게시글/에셋의 태그 목록 */
  tags: string[]
}

/**
 * 카드 우상단 `...` 버튼 → 태그 차단 팝업 (Pixiv 뮤트 방식)
 * - 태그가 없으면 아무것도 렌더링하지 않음
 * - 카드가 <Link>이므로 모든 클릭에서 preventDefault/stopPropagation 처리
 * - relative 컨테이너 안에 배치하는 것을 전제로 absolute 포지셔닝
 */
export default function TagBlockMenu({ tags }: TagBlockMenuProps) {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuthStore()
  const { blockTag, isTagBlocked } = useBlockStore()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // 바깥 클릭 / Escape 키로 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()  // 토글 버튼으로 포커스 복귀
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!tags || tags.length === 0) return null

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }

  const handleToggle = (e: React.MouseEvent) => {
    stop(e)
    setOpen(o => !o)
  }

  const handleBlock = async (e: React.MouseEvent, tag: string) => {
    stop(e)
    if (!isLoggedIn) {
      toast.error('로그인 후 이용할 수 있습니다.')
      navigate('/login')
      return
    }
    if (isTagBlocked(tag)) return
    try {
      await blockTag(tag)
      toast.success(`#${tag} 태그를 차단했습니다.`)
    } catch {
      toast.error('태그 차단에 실패했습니다.')
    }
  }

  return (
    <div ref={boxRef} className="absolute top-2 right-2 z-10" onClick={stop}>
      {/* ... 버튼 */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label="태그 차단 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
      >
        <span className="material-symbols-outlined text-base">more_horiz</span>
      </button>

      {/* 팝업 */}
      {open && (
        <div
          role="menu"
          className="absolute top-9 right-0 w-48 rounded-xl shadow-xl overflow-hidden"
          style={{ background: '#161b22', border: '1px solid #30363d' }}
        >
          <p className="px-3 py-2 text-xs font-bold" style={{ color: '#7d8590', borderBottom: '1px solid #30363d' }}>
            태그 차단
          </p>
          <ul className="max-h-56 overflow-auto py-1">
            {tags.map(tag => {
              const blocked = isTagBlocked(tag)
              return (
                <li key={tag}>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={e => handleBlock(e, tag)}
                    role="menuitem"
                    className="w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2 transition-colors disabled:opacity-50 hover:bg-[#21262d]"
                    style={{ color: blocked ? '#484f58' : '#e6edf3' }}
                  >
                    <span className="truncate">
                      <span style={{ color: '#484f58' }}>#</span>{tag}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: blocked ? '#484f58' : '#f85149' }}>
                      {blocked ? '차단됨' : '차단'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
