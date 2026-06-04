import { useState, useRef, useEffect } from 'react'

// 로컬 타임존 기준 'YYYY-MM-DD' (toISOString은 UTC라 하루 어긋날 수 있어 직접 포맷)
function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

// 'YYYY-MM-DD'를 로컬 타임존 기준 Date로 파싱 (new Date('YYYY-MM-DD')는 UTC로 해석돼 하루 밀릴 수 있음)
function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  value: string                  // 'YYYY-MM-DD' | ''
  onChange: (v: string) => void
  placeholder?: string
}

/**
 * 하이브리드 날짜 입력 — 빠른 선택 버튼(1주일/2주일/1개월 후) + 커스텀 달력 팝업.
 * 과거 날짜는 비활성화. 외부 라이브러리 없이 구현.
 */
export default function DateField({ value, onChange, placeholder = '날짜 선택 (선택사항)' }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayYmd = toYmd(today)

  // 달력에 표시 중인 달 (선택값 있으면 그 달, 없으면 이번 달)
  const [viewMonth, setViewMonth] = useState(() => {
    const base = value ? parseYmd(value) : today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  // 팝업이 열릴 때 선택값 기준 달로 이동
  useEffect(() => {
    if (!open) return
    const base = value ? parseYmd(value) : today
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const setQuick = (days: number) => onChange(toYmd(addDays(today, days)))
  const quickActive = (days: number) => value === toYmd(addDays(today, days))

  const pickDay = (d: Date) => {
    onChange(toYmd(d))
    setOpen(false)
  }

  // 달력 그리드 계산
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay() // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  return (
    <div ref={wrapRef} className="relative">
      {/* 빠른 선택 버튼 */}
      <div className="flex gap-2 flex-wrap mb-2">
        {([['1주일', 7], ['2주일', 14], ['1개월', 30]] as [string, number][]).map(([label, days]) => (
          <button key={days} type="button" onClick={() => setQuick(days)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={quickActive(days)
              ? { background: '#2f81f7', color: '#fff' }
              : { background: '#0d1117', border: '1px solid #30363d', color: '#7d8590' }}>
            {label} 후
          </button>
        ))}
      </div>

      {/* 선택값 표시 + 달력 토글 (버튼 중첩 방지를 위해 컨테이너는 div, 내부 컨트롤만 button) */}
      <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors"
        style={{ background: '#0d1117', border: '1px solid #30363d' }}>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex-1 text-left outline-none"
          style={{ color: value ? '#e6edf3' : '#7d8590' }}>
          {value
            ? parseYmd(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
            : placeholder}
        </button>
        <span className="flex items-center gap-1 shrink-0">
          {value && (
            <button type="button" onClick={() => onChange('')} aria-label="날짜 지우기"
              className="material-symbols-outlined text-base hover:text-white"
              style={{ color: '#7d8590' }}>close</button>
          )}
          <button type="button" onClick={() => setOpen(o => !o)} aria-label="달력 열기"
            className="material-symbols-outlined text-base"
            style={{ color: '#7d8590' }}>calendar_month</button>
        </span>
      </div>

      {/* 달력 팝업 */}
      {open && (
        <div className="absolute z-20 mt-2 p-3 rounded-xl border w-72"
          style={{ background: '#161b22', borderColor: '#30363d', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {/* 월 네비 */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#21262d]" style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <span className="font-bold text-sm">{year}년 {month + 1}월</span>
            <button type="button" onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#21262d]" style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className="text-center text-xs font-bold py-1"
                style={{ color: i === 0 ? '#f85149' : i === 6 ? '#2f81f7' : '#7d8590' }}>{w}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const ymd = toYmd(d)
              const disabled = ymd < todayYmd
              const selected = ymd === value
              return (
                <button key={i} type="button" disabled={disabled} onClick={() => pickDay(d)}
                  className="h-8 rounded-lg text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={selected ? { background: '#2f81f7', color: '#fff' } : { color: '#e6edf3', background: 'transparent' }}
                  onMouseEnter={e => { if (!selected && !disabled) e.currentTarget.style.background = '#21262d' }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}>
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
