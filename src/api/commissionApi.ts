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
  // 공개 목록 (비로그인 허용)
  getOpenList: (params?: { page?: number; size?: number }) =>
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
  agreedPrice: number
  agreedDeadline: string | null
  status: CommissionStatus
  createdAt: string
}

export interface CommissionResponse extends CommissionSummary {
  serviceId: number | null
  requestPostId: number | null
  applicationId: number | null
  paymentId: number | null
  fileUrl: string | null
  completedAt: string | null
  updatedAt: string
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
}

export interface ArtistServiceUpdateRequest {
  title?: string
  description?: string
  serviceType?: ServiceType
  basePrice?: number
  priceMin?: number
  priceMax?: number
  estimatedDays?: number
}

export const artistServiceApi = {
  // 공개 목록 (비로그인 허용)
  getOpenList: (params?: { page?: number; size?: number }) =>
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

  // 지원 수락 (의뢰자) → Commission 자동 생성
  accept: (applicationId: number) =>
    api.post<{ success: boolean }>(`/api/applications/${applicationId}/accept`),

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

  // 파일 업로드
  uploadFile: (commissionId: number, data: { fileType: string; fileUrl: string; fileName: string; fileSize?: number }) =>
    api.post<{ success: boolean; data: CommissionResponse }>(`/api/commissions/${commissionId}/files`, data),
}
