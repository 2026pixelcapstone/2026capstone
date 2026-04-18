import api from '../lib/axios'

export type GalleryType = 'FREE' | 'DEDICATED'
export type Visibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED'

export interface GalleryPostSummary {
  postId: number
  title: string
  thumbnailUrl: string | null
  authorId: number
  authorNickname: string
  authorProfileImageUrl: string | null
  viewCount: number
  likeCount: number
  commentCount: number
  galleryType: GalleryType
  visibility: Visibility
  createdAt: string
  updatedAt: string
}

export interface GalleryPostResponse extends GalleryPostSummary {
  description: string | null
  imageUrls: string[]
  tags: string[]
  remixCount: number
  isEditable: boolean
  isCollaborative: boolean
  originPostId: number | null
  canvasWidth: number | null
  canvasHeight: number | null
  isLiked: boolean
}

export interface GalleryCommentResponse {
  commentId: number
  postId: number
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

export interface GalleryPostCreateRequest {
  title: string
  description?: string
  thumbnailUrl?: string
  galleryType: GalleryType
  visibility: Visibility
  categoryId?: number
  isEditable?: boolean
  isCollaborative?: boolean
  originPostId?: number
  canvasWidth?: number
  canvasHeight?: number
  imageUrls?: string[]
  tags?: string[]
}

export interface GalleryPostUpdateRequest {
  title?: string
  description?: string
  thumbnailUrl?: string
  visibility?: Visibility
  categoryId?: number
  isEditable?: boolean
  imageUrls?: string[]
  tags?: string[]
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  last: boolean 
}

export const galleryApi = {
  // 목록 조회
  getList: (params?: { type?: GalleryType; page?: number; size?: number; sort?: string }) =>
    api.get<{ success: boolean; data: PageResponse<GalleryPostSummary> }>('/api/gallery', { params }),

  // 상세 조회
  getPost: (postId: number) =>
    api.get<{ success: boolean; data: GalleryPostResponse }>(`/api/gallery/${postId}`),

  // 작성
  createPost: (data: GalleryPostCreateRequest) =>
    api.post<{ success: boolean; data: GalleryPostResponse }>('/api/gallery', data),

  // 수정
  updatePost: (postId: number, data: GalleryPostUpdateRequest) =>
    api.patch<{ success: boolean; data: GalleryPostResponse }>(`/api/gallery/${postId}`, data),

  // 삭제
  deletePost: (postId: number) =>
    api.delete<{ success: boolean }>(`/api/gallery/${postId}`),

  // 좋아요 토글
  toggleLike: (postId: number) =>
    api.post<{ success: boolean; data: boolean }>(`/api/gallery/${postId}/like`),

  // 댓글 목록
  getComments: (postId: number, params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<GalleryCommentResponse> }>(`/api/gallery/${postId}/comments`, { params }),

  // 댓글 작성
  createComment: (postId: number, data: { content: string; parentId?: number | null }) =>
    api.post<{ success: boolean; data: GalleryCommentResponse }>(`/api/gallery/${postId}/comments`, data),

  // 댓글 삭제
  deleteComment: (postId: number, commentId: number) =>
    api.delete<{ success: boolean }>(`/api/gallery/${postId}/comments/${commentId}`),

  // 키워드 검색
  search: (keyword: string, params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<GalleryPostSummary> }>('/api/gallery/search', { params: { keyword, ...params } }),

  // 태그별 조회
  getByTag: (tagName: string, params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<GalleryPostSummary> }>(`/api/gallery/tags/${tagName}`, { params }),
}
