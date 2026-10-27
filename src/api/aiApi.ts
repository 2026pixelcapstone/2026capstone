import api, { AI_TIMEOUT_MS } from '../lib/axios'

/** 색 팔레트 추천 결과 — hex(#RRGGBB) 목록. */
export interface PaletteSuggestResult {
  colors: string[]
}

/** 컨셉 도우미 관련 작품 — 카드는 썸네일만 표시(제목은 접근성 alt 용도). */
export interface RelatedPost {
  postId: number
  thumbnailUrl: string | null
  title: string
}

/** 컨셉 도우미 결과 — 색 팔레트 + 검색 키워드 + 관련 작품. */
export interface ConceptResult {
  colors: string[]
  keywords: string[]
  relatedPosts: RelatedPost[]
}

/** 명암 제안 재질 — base는 그 재질 칸의 원래 색, ramp는 단계(-2~2)별 색(#rrggbb). */
export interface ShadeMaterial {
  base: string
  pixels: number
  used: number[]
  ramp: Record<string, string>
}

/** 명암 제안 결과 — levels는 행 우선 height×width(-2~2, 외곽선·투명은 null). */
export interface ShadeSuggestResult {
  width: number
  height: number
  angle: number
  outlinePixels: number
  levels: (number | null)[][]
  materials: ShadeMaterial[]
  model: string
}

export const aiApi = {
  /**
   * 내 작업물 색 추천 — 현재 캔버스 이미지 + 사용된 색 + 자연어(선택)를 근거로 어울리는 색 팔레트 제안.
   * imageBase64는 data URL 접두어 포함/미포함 둘 다 허용(서버가 처리).
   */
  suggestPalette: (body: { imageBase64: string; currentColors: string[]; description?: string }) =>
    api.post<{ success: boolean; data: PaletteSuggestResult }>('/api/ai/palette-suggest', body, { timeout: AI_TIMEOUT_MS }),

  /**
   * 태그로 색 찾기 — 태그/키워드(이미지 없음)로 어울리는 색 팔레트 제안.
   */
  suggestPaletteByTags: (body: { tags: string[] }) =>
    api.post<{ success: boolean; data: PaletteSuggestResult }>('/api/ai/palette-by-tags', body, { timeout: AI_TIMEOUT_MS }),

  /**
   * 컨셉 도우미 — 자연어 컨셉 설명으로 색 팔레트 + 우리 갤러리의 관련 작품 추천.
   */
  suggestConcept: (body: { description: string }) =>
    api.post<{ success: boolean; data: ConceptResult }>('/api/ai/concept', body, { timeout: AI_TIMEOUT_MS }),

  /**
   * 명암 제안(자체 모델) — 64×64 이하 PNG + 광원 각도(0=오른쪽, 90=위, 135=왼쪽 위) → 칸별 명암 단계.
   * 같은 사람은 5초에 한 번(429).
   */
  suggestShade: (body: { imageBase64: string; angle: number }) =>
    api.post<{ success: boolean; data: ShadeSuggestResult }>('/api/ai/shade-suggest', body, { timeout: AI_TIMEOUT_MS }),
}
