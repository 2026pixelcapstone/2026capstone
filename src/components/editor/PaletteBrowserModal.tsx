import { useEffect, useRef, useState } from 'react'
import { paletteApi, type PaletteSort, type PaletteSummary } from '../../api/paletteApi'
import PaletteCard, { PaletteStrip } from '../palette/PaletteCard'
import { useFocusTrap } from '../../hooks/useFocusTrap'

export type PaletteApplyMode = 'replace' | 'append'

interface PaletteBrowserModalProps {
  onClose: () => void
  /** 고른 팔레트 색을 에디터 팔레트에 적용(교체 또는 뒤에 추가) */
  onApply: (colors: string[], mode: PaletteApplyMode, name: string) => void
}

/**
 * 에디터용 팔레트 찾기 모달(커뮤니티 C-1) — 공유 팔레트를 검색해 에디터 팔레트로 가져온다.
 * 에디터 본문과 분리된 컴포넌트(EditorPage는 열기/적용 콜백만 연결).
 */
export default function PaletteBrowserModal({ onClose, onApply }: PaletteBrowserModalProps) {
  const [sort, setSort] = useState<PaletteSort>('popular')
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<PaletteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<PaletteSummary | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(true, ref, onClose)

  useEffect(() => {
    let alive = true   // 정렬·검색을 빠르게 바꿀 때 늦게 온 이전 응답 버리기
    setLoading(true)
    setFailed(false)
    paletteApi.search({ sort, keyword: keyword || undefined, size: 30 })
      .then(res => { if (alive) setItems(res.data.data.content) })
      .catch(() => { if (alive) setFailed(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [sort, keyword])

  const chip = (active: boolean) => ({
    background: active ? 'var(--color-primary)' : 'var(--color-surface-container)',
    color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
    border: '1px solid ' + (active ? 'var(--color-primary)' : 'var(--color-outline)'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-labelledby="palette-browser-title">
      <div ref={ref} className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
          <h2 id="palette-browser-title" className="font-bold">팔레트 가져오기</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1.5 rounded-lg hover:bg-surface-container"
            style={{ color: 'var(--color-on-surface-variant)' }}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
          </button>
        </div>

        {picked ? (
          <div className="p-5 space-y-4">
            <button type="button" onClick={() => setPicked(null)} className="text-sm hover:underline" style={{ color: 'var(--color-on-surface-variant)' }}>
              ← 목록으로
            </button>
            <p className="font-bold">{picked.name} <span className="text-sm font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>{picked.colorCount}색</span></p>
            <PaletteStrip colors={picked.colors} height={64} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => onApply(picked.colors, 'append', picked.name)}
                className="px-4 py-2 rounded-xl text-sm font-bold" style={chip(false)}>
                현재 팔레트 뒤에 추가
              </button>
              <button type="button" onClick={() => onApply(picked.colors, 'replace', picked.name)}
                className="px-4 py-2 rounded-xl text-sm font-bold" style={chip(true)}>
                이 팔레트로 바꾸기
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 px-5 py-3">
              {(['popular', 'recent'] as const).map(s => (
                <button key={s} type="button" onClick={() => setSort(s)} aria-pressed={sort === s}
                  className="px-3 py-1 rounded-lg text-sm" style={chip(sort === s)}>
                  {s === 'popular' ? '인기순' : '최신순'}
                </button>
              ))}
              <form className="ml-auto flex gap-2" onSubmit={e => { e.preventDefault(); setKeyword(keywordInput.trim()) }}>
                <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} placeholder="이름 검색" aria-label="팔레트 이름 검색"
                  className="px-3 py-1 rounded-lg text-sm outline-none w-40"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
                <button type="submit" className="px-3 py-1 rounded-lg text-sm" style={chip(false)}>검색</button>
              </form>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {failed ? (
                <p role="alert" className="text-sm py-10 text-center" style={{ color: 'var(--color-error)' }}>팔레트를 불러오지 못했습니다.</p>
              ) : loading ? (
                <p className="text-sm py-10 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>불러오는 중…</p>
              ) : items.length === 0 ? (
                <p className="text-sm py-10 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>팔레트가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {items.map(p => <PaletteCard key={p.paletteId} palette={p} onSelect={setPicked} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
