import api from '../lib/axios'

/** 색 팔레트 추천 결과 — hex(#RRGGBB) 목록. */
export interface PaletteSuggestResult {
  colors: string[]
}

export const aiApi = {
  /**
   * 내 작업물 색 추천 — 현재 캔버스 이미지 + 사용된 색 + 자연어(선택)를 근거로 어울리는 색 팔레트 제안.
   * imageBase64는 data URL 접두어 포함/미포함 둘 다 허용(서버가 처리).
   */
  suggestPalette: (body: { imageBase64: string; currentColors: string[]; description?: string }) =>
    api.post<{ success: boolean; data: PaletteSuggestResult }>('/api/ai/palette-suggest', body),

  /**
   * 태그로 색 찾기 — 태그/키워드(이미지 없음)로 어울리는 색 팔레트 제안.
   */
  suggestPaletteByTags: (body: { tags: string[] }) =>
    api.post<{ success: boolean; data: PaletteSuggestResult }>('/api/ai/palette-by-tags', body),
}
