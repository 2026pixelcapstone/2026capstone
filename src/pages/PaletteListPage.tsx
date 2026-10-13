import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { paletteApi, type PaletteSort, type PaletteSummary } from '../api/paletteApi'
import PaletteCard from '../components/palette/PaletteCard'
import PaletteFormModal from '../components/palette/PaletteFormModal'
import { useAuthStore } from '../store/authStore'
import { useEmailGate } from '../hooks/useEmailGate'
import { toast } from '../store/toastStore'

const PAGE_SIZE = 24

/** 색 수 필터 — [라벨, min, max] */
const COLOR_RANGES: [string, number | undefined, number | undefined][] = [
  ['전체', undefined, undefined],
  ['2~4색', 2, 4],
  ['5~8색', 5, 8],
  ['9~16색', 9, 16],
  ['17~32색', 17, 32],
  ['33색 이상', 33, undefined],
]

export default function PaletteListPage() {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuthStore()
  const { guard, gateProps } = useEmailGate()

  const [sort, setSort] = useState<PaletteSort>('popular')
  const [range, setRange] = useState(0)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const [items, setItems] = useState<PaletteSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const reqGen = useRef(0)   // 필터를 빠르게 바꿀 때 늦게 온 이전 응답 버리기(TROUBLESHOOTING #26)

  const load = useCallback(async (nextPage: number, append: boolean) => {
    const gen = ++reqGen.current
    const [, min, max] = COLOR_RANGES[range]
    setLoading(true)
    setFailed(false)
    try {
      const res = await paletteApi.search({
        sort, minColors: min, maxColors: max, keyword: keyword || undefined, page: nextPage, size: PAGE_SIZE,
      })
      if (gen !== reqGen.current) return
      const data = res.data.data
      setItems(prev => (append ? [...prev, ...data.content] : data.content))
      setTotal(data.totalElements)
      setPage(nextPage)
      setHasMore(!data.last)
    } catch {
      if (gen === reqGen.current) setFailed(true)
    } finally {
      if (gen === reqGen.current) setLoading(false)
    }
  }, [sort, range, keyword])

  // 필터가 바뀌면 첫 페이지부터
  useEffect(() => { void load(0, false) }, [load])

  const openForm = () => {
    if (!isLoggedIn) { navigate('/login', { state: { from: '/community/palettes' } }); return }
    setShowForm(true)
  }

  const chip = (active: boolean) => ({
    background: active ? 'var(--color-primary)' : 'var(--color-surface-container)',
    color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
    border: '1px solid ' + (active ? 'var(--color-primary)' : 'var(--color-outline)'),
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
          <Link to="/community" className="hover:underline">커뮤니티</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span style={{ color: 'var(--color-on-surface)' }}>팔레트</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">팔레트</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              색 조합을 둘러보고, 받아 가고, 에디터에서 바로 써 보세요. {total > 0 && `· ${total.toLocaleString()}개`}
            </p>
          </div>
          <button type="button" onClick={guard(openForm)} {...gateProps}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
            <span className="material-symbols-outlined text-base">add</span>
            팔레트 등록
          </button>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {(['popular', 'recent'] as const).map(s => (
            <button key={s} type="button" onClick={() => setSort(s)} aria-pressed={sort === s}
              className="px-3 py-1.5 rounded-lg text-sm font-bold" style={chip(sort === s)}>
              {s === 'popular' ? '인기순' : '최신순'}
            </button>
          ))}
          <span className="w-px h-6 mx-1" style={{ background: 'var(--color-outline)' }} />
          {COLOR_RANGES.map(([label], i) => (
            <button key={label} type="button" onClick={() => setRange(i)} aria-pressed={range === i}
              className="px-3 py-1.5 rounded-lg text-sm" style={chip(range === i)}>
              {label}
            </button>
          ))}
          <form className="ml-auto flex gap-2" onSubmit={e => { e.preventDefault(); setKeyword(keywordInput.trim()) }}>
            <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} placeholder="이름 검색" aria-label="팔레트 이름 검색"
              className="px-3 py-1.5 rounded-lg text-sm outline-none w-44"
              style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
            <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-bold" style={chip(false)}>검색</button>
          </form>
        </div>

        {/* 목록 */}
        {failed && items.length === 0 ? (
          <div role="alert" className="flex flex-col items-center py-24 gap-3">
            <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>cloud_off</span>
            <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>팔레트를 불러오지 못했습니다.</p>
            <button type="button" onClick={() => void load(0, false)}
              className="px-4 py-2 rounded-xl font-bold text-sm" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              다시 시도
            </button>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-2">
            <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>palette</span>
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>조건에 맞는 팔레트가 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map(p => <PaletteCard key={p.paletteId} palette={p} />)}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button type="button" onClick={() => void load(page + 1, true)} disabled={loading}
                  className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={chip(false)}>
                  {loading ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}
            {failed && <p role="alert" className="text-center text-sm mt-3" style={{ color: 'var(--color-error)' }}>더 불러오지 못했습니다. 다시 눌러 주세요.</p>}
          </>
        )}
      </div>

      {showForm && (
        <PaletteFormModal
          onClose={() => setShowForm(false)}
          onSaved={p => { toast.success('팔레트를 등록했습니다.'); navigate(`/community/palettes/${p.paletteId}`) }}
        />
      )}
    </div>
  )
}
