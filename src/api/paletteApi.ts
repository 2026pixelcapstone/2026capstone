import api from '../lib/axios'
import type { PageResponse } from './galleryApi'

/** 팔레트 카드(목록) — isOfficial이면 사이트 기본 제공(작성자 없음, author* null) */
export interface PaletteSummary {
  paletteId: number
  name: string
  colors: string[]          // '#rrggbb' 소문자
  colorCount: number
  likeCount: number
  authorId: number | null
  authorNickname: string | null
  authorProfileImageUrl: string | null
  isOfficial: boolean
  createdAt: string
}

/** 팔레트 상세 */
export interface PaletteDetail extends PaletteSummary {
  description: string | null
  isLiked: boolean
  isMine: boolean           // 수정·삭제 가능(작성자 본인, 공식은 항상 false)
  updatedAt: string
}

export interface PaletteRequest {
  name: string
  description?: string
  colors: string[]          // '#rrggbb' 또는 'rrggbb' — 서버가 소문자·중복 제거
}

export type PaletteSort = 'popular' | 'recent'

export interface PaletteSearchParams {
  sort?: PaletteSort
  minColors?: number
  maxColors?: number
  keyword?: string
  authorId?: number
  page?: number
  size?: number
}

export const PALETTE_MIN_COLORS = 2
export const PALETTE_MAX_COLORS = 256

export const paletteApi = {
  search: (params: PaletteSearchParams) =>
    api.get<{ success: boolean; data: PageResponse<PaletteSummary> }>('/api/palettes', { params }),

  get: (paletteId: number) =>
    api.get<{ success: boolean; data: PaletteDetail }>(`/api/palettes/${paletteId}`),

  create: (data: PaletteRequest) =>
    api.post<{ success: boolean; data: PaletteDetail }>('/api/palettes', data),

  update: (paletteId: number, data: PaletteRequest) =>
    api.patch<{ success: boolean; data: PaletteDetail }>(`/api/palettes/${paletteId}`, data),

  remove: (paletteId: number) =>
    api.delete<{ success: boolean }>(`/api/palettes/${paletteId}`),

  // 토글 — 반환 = 토글 후 좋아요 상태
  toggleLike: (paletteId: number) =>
    api.post<{ success: boolean; data: boolean }>(`/api/palettes/${paletteId}/like`),
}
