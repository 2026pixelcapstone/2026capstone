import { useState, useRef, useEffect } from 'react'
import { useFontStore, PRESET_FONTS, type CustomFont } from '../store/fontStore'

const PREVIEW_TEXT = '픽셀아트 PixelHub'
const MAX_FONT_BYTES = 3 * 1024 * 1024 // 3MB (localStorage 보호)

// Google Fonts CSS URL에서 family 이름 추론 (예: ...family=Nanum+Gothic:wght@400 → "Nanum Gothic")
function deriveGoogleFamily(url: string): string {
  try {
    const fam = new URL(url).searchParams.get('family')
    if (!fam) return ''
    return fam.split(':')[0].replace(/\+/g, ' ').trim()
  } catch {
    return ''
  }
}

// 파일 확장자 → CSS @font-face format 값
function formatOf(filename: string): string | undefined {
  const ext = filename.toLowerCase().split('.').pop()
  return ext === 'woff2' ? 'woff2'
    : ext === 'woff' ? 'woff'
    : ext === 'ttf' ? 'truetype'
    : ext === 'otf' ? 'opentype'
    : undefined
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })
}

export default function FontSelector() {
  const { selectedFontId, customFonts, setFont, addCustomFont, removeCustomFont } = useFontStore()
  const [open, setOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ name: '', fontFamily: '', url: '' })
  const [fontFile, setFontFile] = useState<File | null>(null)
  const [formError, setFormError] = useState('')
  const [adding, setAdding] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setForm({ name: '', fontFamily: '', url: '' })
    setFontFile(null)
    setFormError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowAddForm(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const currentLabel = () => {
    const preset = PRESET_FONTS.find(f => f.id === selectedFontId)
    if (preset) return preset.label
    const custom = customFonts.find(f => f.id === selectedFontId)
    return custom?.name ?? '기본'
  }

  const handleAddFont = async () => {
    setFormError('')
    const name = form.name.trim()
    if (!name) return setFormError('폰트 이름을 입력해주세요.')

    try {
      setAdding(true)
      if (fontFile) {
        // ── 파일 업로드 폰트 ──
        if (fontFile.size > MAX_FONT_BYTES) {
          return setFormError('폰트 파일은 3MB 이하만 가능합니다.')
        }
        if (!formatOf(fontFile.name)) {
          return setFormError('.woff2 / .woff / .ttf / .otf 파일만 가능합니다.')
        }
        const dataUrl = await readAsDataURL(fontFile)
        addCustomFont({ name, fontFamily: '', dataUrl, format: formatOf(fontFile.name) })
      } else if (form.url.trim()) {
        // ── Google Fonts URL ── (font-family 미입력 시 URL에서 자동 추론)
        const manual = form.fontFamily.trim()
        const derived = deriveGoogleFamily(form.url.trim())
        const fontFamily = manual || (derived ? `'${derived}', sans-serif` : '')
        if (!fontFamily) {
          return setFormError('font-family를 입력하거나 Google Fonts URL(family 포함)을 사용하세요.')
        }
        addCustomFont({ name, fontFamily, url: form.url.trim() })
      } else if (form.fontFamily.trim()) {
        // ── 시스템 설치 폰트 등 (직접 입력) ──
        addCustomFont({ name, fontFamily: form.fontFamily.trim() })
      } else {
        return setFormError('폰트 파일, Google Fonts URL, font-family 중 하나를 입력하세요.')
      }
      resetForm()
      setShowAddForm(false)
    } catch {
      setFormError('폰트 추가에 실패했습니다.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      {/* 트리거 버튼 */}
      <button
        onClick={() => { setOpen(v => !v); setShowAddForm(false) }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-surface-container-low"
        style={{ color: 'var(--color-on-surface-variant)' }}
        title="폰트 선택"
      >
        <span className="material-symbols-outlined text-lg">font_download</span>
        <span className="hidden xl:inline">{currentLabel()}</span>
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl z-50 overflow-hidden"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
        >
          {/* 프리셋 */}
          <div className="p-3">
            <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1"
              style={{ color: 'var(--color-on-surface-variant)' }}>기본 폰트</p>
            {PRESET_FONTS.map(font => (
              <button
                key={font.id}
                onClick={() => setFont(font.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors hover:bg-surface-container group"
                style={{ background: selectedFontId === font.id ? 'var(--color-surface-container)' : 'transparent' }}
              >
                <div className="text-left">
                  <p className="text-sm font-bold" style={{ fontFamily: font.fontFamily }}>
                    {font.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{
                    color: 'var(--color-on-surface-variant)',
                    fontFamily: font.fontFamily,
                  }}>
                    {PREVIEW_TEXT}
                  </p>
                </div>
                {selectedFontId === font.id && (
                  <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-primary)' }}>
                    check
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 커스텀 폰트 목록 */}
          {customFonts.length > 0 && (
            <div className="px-3 pb-2 border-t" style={{ borderColor: 'var(--color-surface-container)' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1 pt-3"
                style={{ color: 'var(--color-on-surface-variant)' }}>커스텀 폰트</p>
              {customFonts.map((font: CustomFont) => (
                <div
                  key={font.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl group hover:bg-surface-container transition-colors"
                  style={{ background: selectedFontId === font.id ? 'var(--color-surface-container)' : 'transparent' }}
                >
                  <button
                    className="flex-1 text-left"
                    onClick={() => setFont(font.id)}
                  >
                    <p className="text-sm font-bold" style={{ fontFamily: font.fontFamily }}>
                      {font.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)', fontFamily: font.fontFamily }}>
                      {PREVIEW_TEXT}
                    </p>
                  </button>
                  {selectedFontId === font.id && (
                    <span className="material-symbols-outlined text-base shrink-0" style={{ color: 'var(--color-primary)' }}>check</span>
                  )}
                  <button
                    onClick={() => removeCustomFont(font.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-container-highest"
                    style={{ color: 'var(--color-error)' }}
                    title="삭제"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 커스텀 폰트 추가 */}
          <div className="p-3 border-t" style={{ borderColor: 'var(--color-surface-container)' }}>
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-colors hover:bg-surface-container"
                style={{ color: 'var(--color-primary)' }}
              >
                <span className="material-symbols-outlined text-base">add</span>
                커스텀 폰트 추가
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>커스텀 폰트 추가</p>

                <input
                  placeholder="표시 이름 (예: 나눔고딕)"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />

                {/* 폰트 파일 업로드 */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-surface-container"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: fontFile ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)' }}
                >
                  <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-primary)' }}>upload_file</span>
                  <span className="truncate">{fontFile ? fontFile.name : '폰트 파일 업로드 (.woff2/.woff/.ttf/.otf)'}</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                  className="hidden"
                  onChange={e => { setFontFile(e.target.files?.[0] ?? null); setFormError('') }}
                />

                <div className="flex items-center gap-2 px-1">
                  <div className="flex-1 h-px" style={{ background: 'var(--color-surface-container-highest)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-outline-strong)' }}>또는</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--color-surface-container-highest)' }} />
                </div>

                <input
                  placeholder="Google Fonts URL"
                  value={form.url}
                  disabled={!!fontFile}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none disabled:opacity-40"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
                <input
                  placeholder="font-family 직접 입력 (선택·고급)"
                  value={form.fontFamily}
                  disabled={!!fontFile}
                  onChange={e => setForm(f => ({ ...f, fontFamily: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none disabled:opacity-40"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
                />
                <p className="text-xs px-1 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                  파일을 올리거나, Google Fonts URL만 붙여도 됩니다(이름 자동 인식).<br />
                  예: https://fonts.googleapis.com/css2?family=Nanum+Gothic
                </p>

                {formError && (
                  <p className="text-xs" style={{ color: 'var(--color-error)' }}>{formError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleAddFont}
                    disabled={adding}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--color-primary)', color: '#fff' }}
                  >
                    {adding ? '추가 중...' : '추가'}
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); resetForm() }}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors hover:bg-surface-container"
                    style={{ color: 'var(--color-on-surface-variant)' }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
