import api from '../lib/axios'
import type { TokenResponse } from './authApi'

export interface UserProfileResponse {
  userId: number
  /** 내 정보(getMe·프로필 수정·사진 응답)에만 있음 — 다른 사람 조회(공개 프로필·팔로워 목록)는 null */
  email: string
  nickname: string
  bio: string | null
  profileImageUrl: string | null
  websiteUrl: string | null
  followerCount: number
  followingCount: number
  isPublic: boolean
  isFollowing: boolean
  emailVerified: boolean
  role: string
  createdAt: string
  /** 비밀번호 로그인 가능 여부(소셜 전용이면 false) — 내 정보 응답에만 있음, 타인 조회는 null */
  hasPassword?: boolean | null
}

export interface ProfileUpdateRequest {
  nickname?: string
  bio?: string
  websiteUrl?: string
  // profileImageUrl은 보내지 않음 — 사진은 uploadProfileImage/removeProfileImage 전용(서버가 PATCH에서 무시)
  isPublic?: boolean
}

/** 메인 '인기 작가' — recentLikes = 최근 기간 받은 좋아요(팔로워순으로 채운 항목은 0) */
export interface PopularUser {
  userId: number
  nickname: string
  profileImageUrl: string | null
  followerCount: number
  recentLikes: number
}

export const userApi = {
  // 내 프로필 조회
  getMe: () =>
    api.get<{ success: boolean; data: UserProfileResponse }>('/api/users/me'),

  // 내 프로필 수정
  updateMe: (data: ProfileUpdateRequest) =>
    api.patch<{ success: boolean; data: UserProfileResponse }>('/api/users/me', data),

  // 비밀번호 변경 — 성공 시 다른 기기는 로그아웃, 현재 기기용 새 토큰이 응답으로 옴(authStore에 반영 필요)
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ success: boolean; message: string; data: TokenResponse }>('/api/users/me/password', { currentPassword, newPassword }),

  // 프로필 사진 업로드/교체 — PNG·JPEG·GIF·WebP, 최대 2MB(서버 검증). 저장 경로는 서버가 정함
  uploadProfileImage: (image: Blob, filename: string) => {
    const form = new FormData()
    form.append('file', image, filename)
    return api.post<{ success: boolean; data: UserProfileResponse }>('/api/users/me/profile-image', form)
  },

  // 프로필 사진 제거(기본 아바타로)
  removeProfileImage: () =>
    api.delete<{ success: boolean; data: UserProfileResponse }>('/api/users/me/profile-image'),

  // 특정 유저 프로필 조회 (userId)
  getUser: (userId: number) =>
    api.get<{ success: boolean; data: UserProfileResponse }>(`/api/users/${userId}`),

  // 메인 인기 작가(비로그인 허용)
  getPopular: (params?: { days?: number; size?: number }) =>
    api.get<{ success: boolean; data: PopularUser[] }>('/api/users/popular', { params }),

  // 닉네임으로 유저 프로필 조회 (프로필 페이지용)
  getUserByNickname: (nickname: string) =>
    api.get<{ success: boolean; data: UserProfileResponse }>(`/api/users/by-nickname/${nickname}`),

  // 팔로우
  follow: (userId: number) =>
    api.post<{ success: boolean }>(`/api/users/${userId}/follow`),

  // 언팔로우
  unfollow: (userId: number) =>
    api.delete<{ success: boolean }>(`/api/users/${userId}/follow`),

  // 팔로워 목록
  getFollowers: (userId: number) =>
    api.get<{ success: boolean; data: UserProfileResponse[] }>(`/api/users/${userId}/followers`),

  // 팔로잉 목록
  getFollowing: (userId: number) =>
    api.get<{ success: boolean; data: UserProfileResponse[] }>(`/api/users/${userId}/following`),
}
