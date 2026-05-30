import { useState, useEffect, useRef, useCallback } from 'react'
import { tagApi, type TagResponse } from '../api/tagApi'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  max?: number
  placeholder?: string
}

/**
 * 태그 입력 컴포넌트 (에셋/갤러리 공용)
 * - 입력 중 기존 태그가 있으면 자동완성 드롭다운 표시
 * - 없는 태그는 Enter/쉼표로 자유 태그 추가
 * - 드롭다운: ↑/↓ 이동, Enter 선택, Esc 닫기
 */
export default function TagInput({ tags, onChange, max = 10, placeholder = '태그 입력 후 Enter...' }: TagInputProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<TagResponse[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const boxRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const atMax = tags.length >= max

  // ── 디바운스 서버 검색 ───────────────────────────────────
  useEffect(() => {
    const keyword = input.trim()
    if (!keyword || atMax) {
      setSuggestions([])
      setOpen(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await tagApi.search(keyword)
        // 이미 선택된 태그는 후보에서 제외
        const filtered = res.data.data.filter(t => !tags.includes(t.tagName))
        setSuggestions(filtered)
        setOpen(filtered.length > 0)
        setActiveIdx(-1)
      } catch {
        setSuggestions([])
        setOpen(false)
      }
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [input, tags, atMax])

  // ── 바깥 클릭 시 드롭다운 닫기 ───────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addTag = useCallback((raw: string) => {
    const name = raw.trim()
    if (!name) return
    if (tags.includes(name) || tags.length >= max) { setInput(''); setOpen(false); return }
    onChange([...tags, name])
    setInput('')
    setSuggestions([])
    setOpen(false)
    setActiveIdx(-1)
  }, [tags, onChange, max])

  const removeTag = (name: string) => onChange(tags.filter(t => t !== name))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      // 드롭다운에서 선택된 항목이 있으면 그것을, 아니면 입력값을 자유 태그로 추가
      if (open && activeIdx >= 0 && suggestions[activeIdx]) {
        addTag(suggestions[activeIdx].tagName)
      } else {
        addTag(input)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      // 입력이 비었을 때 Backspace로 마지막 태그 제거
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div ref={boxRef} className="relative">
      {/* 입력 */}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        disabled={atMax}
        placeholder={atMax ? `최대 ${max}개까지 추가할 수 있습니다.` : placeholder}
        className="w-full bg-[#1a1a2e] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {/* 자동완성 드롭다운 */}
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-gray-600 bg-[#161b22] shadow-xl"
        >
          {suggestions.map((s, idx) => (
            <li
              key={s.tagId}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseDown={e => { e.preventDefault(); addTag(s.tagName) }}
              className={`px-4 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                idx === activeIdx ? 'bg-blue-900/40 text-blue-300' : 'text-gray-300'
              }`}
            >
              <span className="text-gray-500">#</span>{s.tagName}
            </li>
          ))}
        </ul>
      )}

      {/* 선택된 태그 칩 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-900 text-blue-300">
              #{tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-white" aria-label={`${tag} 태그 제거`}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
