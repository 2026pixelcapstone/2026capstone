import api from '../lib/axios'
import type { PageResponse } from './galleryApi'

// ─── 의뢰 게시판 (request_posts) ────────────────────────────────────────────

export type RequestPostStatus = 'OPEN' | 'CLOSED'

export interface RequestPostSummary {
  requestPostId: number
  title: string
  clientId: number
  clientNickname: string | null
  budgetMin: number | null
  budgetMax: number | null
  deadline: string | null   // 'YYYY-MM-DD'
  status: RequestPostStatus
  createdAt: string
}

export interface RequestPostResponse extends RequestPostSummary {
  description: string | null
  clientProfileImageUrl: string | null
  updatedAt: string
}

export interface RequestPostCreateRequest {
  title: string
  description?: string
  budgetMin?: number
  budgetMax?: number
  deadline?: string   // 'YYYY-MM-DD'
}

export interface RequestPostUpdateRequest {
  title?: string
  description?: string
  budgetMin?: number
  budgetMax?: number
  deadline?: string
}

export const requestPostApi = {
  // 공개 목록 (비로그인 허용) — keyword/sort 선택
  getOpenList: (params?: { page?: number; size?: number; sort?: string; keyword?: string }) =>
    api.get<{ success: boolean; data: PageResponse<RequestPostSummary> }>('/api/request-posts', { params }),

  // 내가 등록한 목록
  getMyList: (params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<RequestPostSummary> }>('/api/request-posts/my', { params }),

  // 상세
  getPost: (requestPostId: number) =>
    api.get<{ success: boolean; data: RequestPostResponse }>(`/api/request-posts/${requestPostId}`),

  // 등록
  create: (data: RequestPostCreateRequest) =>
    api.post<{ success: boolean; data: RequestPostResponse }>('/api/request-posts', data),

  // 수정
  update: (requestPostId: number, data: RequestPostUpdateRequest) =>
    api.patch<{ success: boolean; data: RequestPostResponse }>(`/api/request-posts/${requestPostId}`, data),

  // 마감 처리
  close: (requestPostId: number) =>
    api.post<{ success: boolean }>(`/api/request-posts/${requestPostId}/close`),

  // 삭제
  delete: (requestPostId: number) =>
    api.delete<{ success: boolean }>(`/api/request-posts/${requestPostId}`),
}

// ─── 계약 (commissions) ────────────────────────────────────────────────────

export type CommissionStatus = 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'CANCELLED'

export interface CommissionSummary {
  commissionId: number
  commissionType: string
  clientId: number
  clientNickname: string | null
  artistId: number
  artistNickname: string | null
  title: string | null   // 거래 기록 스냅샷 — 무슨 작업이었는지(원글 삭제돼도 보존)
  agreedPrice: number
  agreedDeadline: string | null
  status: CommissionStatus
  createdAt: string
  unreadCount: number   // 내가 안 읽은 채팅 메시지 수 (목록 배지용)
}

export interface CommissionResponse extends CommissionSummary {
  serviceId: number | null
  requestPostId: number | null
  applicationId: number | null
  paymentId: number | null
  description: string | null          // 거래 기록 스냅샷 — 의뢰/서비스 내용
  deliveryFiles: DeliveryFile[]       // 원본 납품물(다중) — 의뢰자에겐 완료(COMPLETED) 전까지 빈 배열
  deliveryFileCount: number           // 작가 납품 파일 수 — 마스킹 무관(의뢰자가 몇 개 납품됐는지 알 수 있게)
  previewImages: PreviewImage[]       // 워터마크 미리보기(다중) — 원본 업로드 시 자동 생성, 검토 단계에서 노출
  // 타임라인 — 단계 전이 시각(수락=createdAt, 검토요청, 완료, 취소)
  reviewRequestedAt: string | null
  cancelledAt: string | null
  completedAt: string | null
  updatedAt: string
}

export interface DeliveryFile {
  fileId: number
  fileUrl: string
  fileName: string
}

export interface PreviewImage {
  previewImageId: number
  imageUrl: string
  // 이 미리보기를 만든 원본 파일명(자동 생성분만) — 확장자로 "GIF 애니메이션" 라벨 표시용
  sourceFileName: string | null
}

// ─── 작가 서비스 (commission_services) ────────────────────────────────────────

export type ArtistServiceStatus = 'OPEN' | 'CLOSED'
export type ServiceType = 'OPTION' | 'QUOTE'

export interface ArtistServiceSummary {
  serviceId: number
  artistId: number
  artistNickname: string | null
  artistProfileImageUrl: string | null
  title: string
  serviceType: ServiceType
  basePrice: number | null
  priceMin: number | null
  priceMax: number | null
  estimatedDays: number | null
  category: string
  status: ArtistServiceStatus
  createdAt: string
}

export interface ArtistServiceResponse extends ArtistServiceSummary {
  description: string | null
  updatedAt: string
}

export interface ArtistServiceCreateRequest {
  title: string
  description?: string
  serviceType: ServiceType
  basePrice?: number
  priceMin?: number
  priceMax?: number
  estimatedDays?: number
  category?: string
}

export interface ArtistServiceUpdateRequest {
  title?: string
  description?: string
  serviceType?: ServiceType
  basePrice?: number
  priceMin?: number
  priceMax?: number
  estimatedDays?: number
  category?: string
}

export const artistServiceApi = {
  // 공개 목록 (비로그인 허용) — category/keyword/sort 선택
  getOpenList: (params?: { page?: number; size?: number; sort?: string; category?: string; keyword?: string }) =>
    api.get<{ success: boolean; data: PageResponse<ArtistServiceSummary> }>('/api/artist-services', { params }),

  // 내 서비스 목록
  getMyList: (params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<ArtistServiceSummary> }>('/api/artist-services/my', { params }),

  // 상세
  getService: (serviceId: number) =>
    api.get<{ success: boolean; data: ArtistServiceResponse }>(`/api/artist-services/${serviceId}`),

  // 등록
  create: (data: ArtistServiceCreateRequest) =>
    api.post<{ success: boolean; data: ArtistServiceResponse }>('/api/artist-services', data),

  // 수정
  update: (serviceId: number, data: ArtistServiceUpdateRequest) =>
    api.patch<{ success: boolean; data: ArtistServiceResponse }>(`/api/artist-services/${serviceId}`, data),

  // 마감 처리
  close: (serviceId: number) =>
    api.post<{ success: boolean }>(`/api/artist-services/${serviceId}/close`),

  // 삭제
  delete: (serviceId: number) =>
    api.delete<{ success: boolean }>(`/api/artist-services/${serviceId}`),
}

// ─── 지원 (commission_applications) ──────────────────────────────────────────

export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export interface ApplicationResponse {
  applicationId: number
  requestPostId: number
  requestPostTitle: string
  artistId: number
  artistNickname: string | null
  artistProfileImageUrl: string | null
  message: string | null
  proposedPrice: number | null
  status: ApplicationStatus
  createdAt: string
  // 수락 시 생성된 커미션 (ACCEPTED 지원에만 존재) — 거래룸 바로가기/취소 상태 표시용
  commissionId: number | null
  commissionStatus: CommissionStatus | null
}

export interface ApplicationCreateRequest {
  requestPostId: number
  message?: string
  proposedPrice?: number
}

export const applicationApi = {
  // 지원하기 (작가)
  apply: (data: ApplicationCreateRequest) =>
    api.post<{ success: boolean; data: ApplicationResponse }>('/api/applications', data),

  // 작가의 내 지원 목록
  getMyApplications: (params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<ApplicationResponse> }>('/api/applications/my', { params }),

  // 의뢰자가 특정 의뢰의 지원 목록 조회
  getByPost: (requestPostId: number, params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<ApplicationResponse> }>(`/api/applications/by-post/${requestPostId}`, { params }),

  // 지원 수락 (의뢰자) → Commission 자동 생성, 생성된 커미션 ID 반환
  accept: (applicationId: number) =>
    api.post<{ success: boolean; data: number }>(`/api/applications/${applicationId}/accept`),

  // 지원 취소 (작가, PENDING만)
  cancel: (applicationId: number) =>
    api.delete<{ success: boolean }>(`/api/applications/${applicationId}`),
}

export interface CommissionCreateRequest {
  commissionType: 'SERVICE_OPTION' | 'SERVICE_QUOTE' | 'REQUEST'
  artistId: number
  serviceId?: number
  requestPostId?: number
  applicationId?: number
  agreedPrice: number
  agreedDeadline?: string       // 'YYYY-MM-DD'
}

export const commissionApi = {
  // 의뢰 직접 생성 (작가 서비스에서 의뢰하기)
  createCommission: (data: CommissionCreateRequest) =>
    api.post<{ success: boolean; data: CommissionResponse }>('/api/commissions', data),

  // 내 계약 목록 (의뢰자)
  getMyListAsClient: (params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<CommissionSummary> }>('/api/commissions/my/client', { params }),

  // 내 계약 목록 (작가)
  getMyListAsArtist: (params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: PageResponse<CommissionSummary> }>('/api/commissions/my/artist', { params }),

  // 상세
  getCommission: (commissionId: number) =>
    api.get<{ success: boolean; data: CommissionResponse }>(`/api/commissions/${commissionId}`),

  // 상태 변경
  updateStatus: (commissionId: number, status: CommissionStatus) =>
    api.patch<{ success: boolean; data: CommissionResponse }>(`/api/commissions/${commissionId}/status`, { status }),

  // 취소
  cancel: (commissionId: number) =>
    api.post<{ success: boolean }>(`/api/commissions/${commissionId}/cancel`),

  // 납품/참고 파일 업로드 (멀티파트, 다중) — "원본 = 미리보기" 재설계.
  // 서버가 원본을 R2에 저장하고, 작가 납품 이미지면 워터마크 미리보기를 자동 생성(gif=첫 프레임).
  // (기존 R2 2단계 업로드 + 미리보기 별도 업로드는 폐지)
  uploadFiles: (commissionId: number, files: File[], fileType = 'FINAL') => {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    formData.append('fileType', fileType)
    return api.post<{ success: boolean; data: CommissionResponse }>(
      `/api/commissions/${commissionId}/files`, formData)
  },

  // 납품 파일 1개 삭제 (작가) — 자동 생성된 미리보기도 서버에서 연동 삭제
  deleteFile: (commissionId: number, fileId: number) =>
    api.delete<{ success: boolean; data: CommissionResponse }>(
      `/api/commissions/${commissionId}/files/${fileId}`),
}
