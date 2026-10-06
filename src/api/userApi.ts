import api from '../lib/axios'

export interface UserProfileResponse {
  userId: number
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
}

export interface ProfileUpdateRequest {
  nickname?: string
  bio?: string
  websiteUrl?: string
  // profileImageUrl은 보내지 않음 — 사진은 uploadProfileImage/removeProfileImage 전용(서버가 PATCH에서 무시)
  isPublic?: boolean
}

export const userApi = {
  // 내 프로필 조회
  getMe: () =>
    api.get<{ success: boolean; data: UserProfileResponse }>('/api/users/me'),

  // 내 프로필 수정
  updateMe: (data: ProfileUpdateRequest) =>
    api.patch<{ success: boolean; data: UserProfileResponse }>('/api/users/me', data),

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
