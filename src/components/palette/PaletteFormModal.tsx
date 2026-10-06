import { useRef, useState } from 'react'
import { paletteApi, PALETTE_MAX_COLORS, PALETTE_MIN_COLORS, type PaletteDetail } from '../../api/paletteApi'
import { parseHexList } from '../../lib/paletteExport'
import { getErrorMessage } from '../../lib/errorUtils'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface PaletteFormModalProps {
  /** 수정이면 대상 id, 없으면 새로 등록 */
  paletteId?: number
  initialName?: string
  initialDescription?: string
  initialColors?: string[]
  onClose: () => void
  onSaved: (palette: PaletteDetail) => void
}

/**
 * 팔레트 등록·수정 모달 — 커뮤니티 페이지와 에디터('현재 팔레트 저장') 공용.
 * 색 추가: 색 선택기 / HEX 목록 붙여넣기(.hex 파일 내용·콤마·줄바꿈 모두 허용). 색 클릭 시 제거.
 */
export default function PaletteFormModal({
  paletteId, initialName = '', initialDescription = '', initialColors = [], onClose, onSaved,
}: PaletteFormModalProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [colors, setColors] = useState<string[]>(() => parseHexList(initialColors.join(' ')).slice(0, PALETTE_MAX_COLORS))
  const [picker, setPicker] = useState('#2f81f7')
  const [pasteText, setPasteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const close = () => { if (!submitting) onClose() }
  useFocusTrap(true, ref, close)

  /** 순서 유지·중복 제외로 추가, 최대 개수 초과분은 버리고 안내 */
  const addColors = (list: string[]) => {
    const seen = new Set(colors)
    const next = [...colors]
    let overflow = false
    for (const c of list) {
      if (seen.has(c)) continue
      if (next.length >= PALETTE_MAX_COLORS) { overflow = true; break }
      seen.add(c)
      next.push(c)
    }
    setColors(next)
    setError(overflow ? `색은 최대 ${PALETTE_MAX_COLORS}개까지 넣을 수 있습니다.` : '')
  }

  const handlePaste = () => {
    const list = parseHexList(pasteText)
    if (list.length === 0) { setError('붙여넣은 내용에서 #rrggbb 색을 찾지 못했습니다.'); return }
    addColors(list)
    setPasteText('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!name.trim()) { setError('팔레트 이름을 입력해주세요.'); return }
    if (colors.length < PALETTE_MIN_COLORS) { setError(`색을 ${PALETTE_MIN_COLORS}개 이상 넣어주세요.`); return }
    setSubmitting(true)
    setError('')
    try {
      const body = { name: name.trim(), description: description.trim() || undefined, colors }
      const res = paletteId ? await paletteApi.update(paletteId, body) : await paletteApi.create(body)
      onSaved(res.data.data)
    } catch (err) {
      setError(getErrorMessage(err, '팔레트를 저장하지 못했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = { background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) close() }}
      role="dialog" aria-modal="true" aria-labelledby="palette-form-title">
      <div ref={ref} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="palette-form-title" className="text-lg font-bold">{paletteId ? '팔레트 수정' : '팔레트 등록'}</h2>
          <button type="button" onClick={close} aria-label="닫기"
            className="p-1.5 rounded-lg hover:bg-surface-container" style={{ color: 'var(--color-on-surface-variant)' }}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="palette-name" className="block text-sm font-bold mb-1.5">이름 *</label>
            <input id="palette-name" value={name} onChange={e => setName(e.target.value)} maxLength={50}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="palette-desc" className="block text-sm font-bold mb-1.5">설명</label>
            <textarea id="palette-desc" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={2}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold">색 *</span>
              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {colors.length} / {PALETTE_MAX_COLORS} · 색을 누르면 빠집니다
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-10 p-2 rounded-lg" style={{ background: 'var(--color-surface-container-low)' }}>
              {colors.length === 0 && <span className="text-xs self-center" style={{ color: 'var(--color-outline-strong)' }}>아직 색이 없습니다</span>}
              {colors.map(c => (
                <button key={c} type="button" title={`${c} 빼기`} aria-label={`${c} 빼기`}
                  onClick={() => setColors(prev => prev.filter(x => x !== c))}
                  className="w-7 h-7 rounded border hover:scale-110 transition-transform"
                  style={{ background: c, borderColor: 'var(--color-outline)' }} />
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input type="color" value={picker} onChange={e => setPicker(e.target.value)} aria-label="추가할 색 고르기"
                className="w-9 h-9 rounded cursor-pointer bg-transparent" />
              <button type="button" onClick={() => addColors([picker.toLowerCase()])}
                className="px-3 py-2 rounded-lg text-sm font-bold hover:bg-surface-container"
                style={{ border: '1px solid var(--color-outline)' }}>
                색 추가
              </button>
            </div>

            <div className="mt-2">
              <label htmlFor="palette-paste" className="block text-xs mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                HEX 목록 붙여넣기(콤마·공백·줄바꿈 구분, .hex 파일 내용 가능)
              </label>
              <div className="flex gap-2">
                <textarea id="palette-paste" value={pasteText} onChange={e => setPasteText(e.target.value)} rows={2}
                  placeholder="#2b1b3d, #4e2a5a, 8a3b6a …"
                  className="flex-1 px-3 py-2 rounded-lg text-xs outline-none resize-none font-mono" style={inputStyle} />
                <button type="button" onClick={handlePaste} disabled={!pasteText.trim()}
                  className="px-3 rounded-lg text-sm font-bold hover:bg-surface-container disabled:opacity-50"
                  style={{ border: '1px solid var(--color-outline)' }}>
                  추가
                </button>
              </div>
            </div>
          </div>

          {error && <p role="alert" className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={close}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm hover:bg-surface-container"
              style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
              취소
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
