import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CustomFont {
  id: string
  name: string        // 표시 이름 (예: "나눔고딕")
  fontFamily: string  // CSS font-family 값 (예: "'Nanum Gothic', sans-serif")
  url?: string        // Google Fonts CSS 링크 (선택)
  dataUrl?: string    // 업로드 폰트 파일 base64 dataURL (선택, localStorage 저장)
  format?: string     // 폰트 포맷 (woff2|woff|truetype|opentype) — 파일 업로드 시
}

export interface PresetFont {
  id: string
  name: string
  label: string       // 한글 설명
  fontFamily: string
}

export const PRESET_FONTS: PresetFont[] = [
  {
    id: 'pretendard',
    name: 'Pretendard',
    label: '기본 (Pretendard)',
    fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif",
  },
  {
    id: 'galmuri11',
    name: 'Galmuri11',
    label: '갈무리체',
    fontFamily: "'Galmuri11', sans-serif",
  },
  {
    id: 'maplestory',
    name: 'Maplestory',
    label: '메이플스토리',
    fontFamily: "'Maplestory', sans-serif",
  },
]

interface FontState {
  selectedFontId: string
  customFonts: CustomFont[]
  setFont: (fontId: string) => void
  addCustomFont: (font: Omit<CustomFont, 'id'>) => void
  removeCustomFont: (id: string) => void
}

export const useFontStore = create<FontState>()(
  persist(
    (set, get) => ({
      selectedFontId: 'pretendard',
      customFonts: [],

      setFont: (fontId) => {
        set({ selectedFontId: fontId })
        applyFont(fontId, get().customFonts)
      },

      addCustomFont: (font) => {
        const id = `custom_${Date.now()}`
        // 파일 업로드 폰트는 id 기반 고유 family로 @font-face 주입 (이름 충돌 방지)
        const fontFamily = font.dataUrl ? `'ppf-${id}', sans-serif` : font.fontFamily
        const newFont: CustomFont = { ...font, id, fontFamily }
        const updated = [...get().customFonts, newFont]

        if (newFont.dataUrl) injectFontFace(id, `ppf-${id}`, newFont.dataUrl, newFont.format)
        else if (newFont.url) injectFontLink(id, newFont.url)

        // 추가 즉시 선택·적용 (이전엔 수동 클릭 전까지 변화 없어 "안 된다"고 느껴짐)
        set({ customFonts: updated, selectedFontId: id })
        applyFont(id, updated)
      },

      removeCustomFont: (id) => {
        const updated = get().customFonts.filter(f => f.id !== id)
        set((state) => ({
          customFonts: updated,
          // 삭제된 폰트가 선택 중이었으면 기본으로 복구
          selectedFontId: state.selectedFontId === id ? 'pretendard' : state.selectedFontId,
        }))
        // 선택이 기본으로 돌아갔으면 즉시 반영
        if (get().selectedFontId === 'pretendard') applyFont('pretendard', updated)
        // 주입된 <link>/<style> 태그 제거
        document.getElementById(`font-link-${id}`)?.remove()
        document.getElementById(`font-face-${id}`)?.remove()
      },
    }),
    { name: 'font-storage' }
  )
)

/** body에 CSS 변수 적용 */
export function applyFont(fontId: string, customFonts: CustomFont[]) {
  const preset = PRESET_FONTS.find(f => f.id === fontId)
  const custom = customFonts.find(f => f.id === fontId)
  const fontFamily = preset?.fontFamily ?? custom?.fontFamily ?? "'Pretendard Variable', sans-serif"
  document.documentElement.style.setProperty('--site-font', fontFamily)
}

/** Google Fonts 등 외부 URL을 <link>로 동적 주입 */
function injectFontLink(id: string, url: string) {
  if (document.getElementById(`font-link-${id}`)) return
  const link = document.createElement('link')
  link.id = `font-link-${id}`
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}

/** 업로드 폰트 파일(dataURL)을 <style> @font-face로 주입 */
function injectFontFace(id: string, family: string, dataUrl: string, format?: string) {
  let style = document.getElementById(`font-face-${id}`) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = `font-face-${id}`
    document.head.appendChild(style)
  }
  const fmt = format ? ` format('${format}')` : ''
  style.textContent =
    `@font-face{font-family:'${family}';src:url('${dataUrl}')${fmt};font-display:swap;}`
}

/** 앱 초기화 시 저장된 폰트 + 커스텀 URL 복원 */
export function restoreFonts() {
  const raw = localStorage.getItem('font-storage')
  if (!raw) return
  try {
    const { state } = JSON.parse(raw)
    const { selectedFontId, customFonts } = state as FontState
    // 커스텀 폰트 재주입 (파일=@font-face, URL=<link>)
    customFonts?.forEach((f: CustomFont) => {
      if (f.dataUrl) injectFontFace(f.id, `ppf-${f.id}`, f.dataUrl, f.format)
      else if (f.url) injectFontLink(f.id, f.url)
    })
    applyFont(selectedFontId, customFonts ?? [])
  } catch {
    // 파싱 실패 시 무시
  }
}
