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
  tags: string[]
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

export interface TagResponse {
  tagId: number
  tagName: string
  postCount: number
}

export const galleryApi = {
  // 목록 조회
  getList: (params?: { type?: GalleryType; page?: number; size?: number; sort?: string; authorId?: number; likedBy?: number }) =>
    api.get<{ success: boolean; data: PageResponse<GalleryPostSummary> }>('/api/gallery', { params }),

  // 여러 작가 포트폴리오 배치 조회 (authorId → 대표작 목록). 카드 목록 N+1 방지용.
  // Spring List<Long> 바인딩 위해 콤마 조인 문자열로 전송.
  // JSON 객체 키는 항상 문자열이라 Record<string, ...> (호출부에서 Number(id)로 변환).
  // 빈 배열 방어는 호출부(length>0 가드)에 맡김.
  getPortfolios: (authorIds: number[], perAuthor = 3) =>
    api.get<{ success: boolean; data: Record<string, GalleryPostSummary[]> }>(
      '/api/gallery/portfolios',
      { params: { authorIds: authorIds.join(','), perAuthor } },
    ),

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

  // 조회수 증가 (데이터 조회와 분리)
  incrementView: (postId: number) =>
    api.post<{ success: boolean }>(`/api/gallery/${postId}/view`),

  // 태그별 조회
  getByTag: (tagName: string, params?: { page?: number; size?: number; sort?: string; type?: GalleryType }) =>
    api.get<{ success: boolean; data: PageResponse<GalleryPostSummary> }>(`/api/gallery/tags/${tagName}`, { params }),

  // 인기 태그 TOP20
  getTags: () =>
    api.get<{ success: boolean; data: TagResponse[] }>('/api/tags'),
}
