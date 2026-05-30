import api from '../lib/axios'
import type { PageResponse } from './galleryApi'

export interface AssetSummary {
  assetId: number
  title: string
  thumbnailUrl: string | null
  authorId: number
  authorNickname: string
  authorProfileImageUrl: string | null
  price: number
  isFree: boolean
  downloadCount: number
  likeCount: number
  commentCount: number
  status: string
  createdAt: string
  tags: string[]
}

export interface AssetResponse extends AssetSummary {
  description: string | null
  imageUrls: string[]
  fileUrl: string | null
  tags: string[]
  licenseTypeName: string | null
  isLiked: boolean
  isPurchased: boolean
  updatedAt: string
}

export interface AssetCommentResponse {
  commentId: number
  assetId: number
  parentId: number | null
  authorId: number
  authorNickname: string
  authorProfileImageUrl: string | null
  content: string
  isDeleted: boolean
  replyCount: number
  createdAt: string
  updatedAt: string
}

export interface AssetCreateRequest {
  title: string
  description?: string
  thumbnailUrl?: string
  price?: number
  isFree: boolean
  categoryId?: number
  licenseTypeId?: number
  imageUrls?: string[]
  tags?: string[]
  fileUrl?: string
  fileSize?: number
}

export interface AssetUpdateRequest {
  title?: string
  description?: string
  thumbnailUrl?: string
  price?: number
  isFree?: boolean
  categoryId?: number
  licenseTypeId?: number
  imageUrls?: string[]
  tags?: string[]
}

export const assetApi = {
  // 목록 조회
  getList: (params?: { isFree?: boolean; page?: number; size?: number; sort?: string; authorId?: number }) =>
    api.get<{ success: boolean; data: PageResponse<AssetSummary> }>('/api/assets', { params }),

  // 상세 조회
  getAsset: (assetId: number) =>
    api.get<{ success: boolean; data: AssetResponse }>(`/api/assets/${assetId}`),

  // 업로드
  createAsset: (data: AssetCreateRequest) =>
    api.post<{ success: boolean; data: AssetResponse }>('/api/assets', data),

  // 수정
  updateAsset: (assetId: number, data: AssetUpdateRequest) =>
    api.patch<{ success: boolean; data: AssetResponse }>(`/api/assets/${assetId}`, data),

  // 삭제
  deleteAsset: (assetId: number) =>
    api.delete<{ success: boolean }>(`/api/assets/${assetId}`),

  // 좋아요 토글
  toggleLike: (assetId: number) =>
    api.post<{ success: boolean; data: boolean }>(`/api/assets/${assetId}/like`),

  // 구매
  purchase: (assetId: number) =>
    api.post<{ success: boolean }>(`/api/assets/${assetId}/purchase`),

  // 댓글 목록
  getComments: (assetId: number, params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<AssetCommentResponse> }>(`/api/assets/${assetId}/comments`, { params }),

  // 댓글 작성
  createComment: (assetId: number, data: { content: string; parentId?: number | null }) =>
    api.post<{ success: boolean; data: AssetCommentResponse }>(`/api/assets/${assetId}/comments`, data),

  // 댓글 삭제
  deleteComment: (assetId: number, commentId: number) =>
    api.delete<{ success: boolean }>(`/api/assets/${assetId}/comments/${commentId}`),

  // 키워드 검색
  search: (keyword: string, params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<AssetSummary> }>('/api/assets/search', { params: { keyword, ...params } }),

  // 태그별 조회
  getByTag: (tagName: string, params?: { page?: number; size?: number; sort?: string; isFree?: boolean }) =>
    api.get<{ success: boolean; data: PageResponse<AssetSummary> }>(`/api/assets/tags/${encodeURIComponent(tagName)}`, { params }),
}
