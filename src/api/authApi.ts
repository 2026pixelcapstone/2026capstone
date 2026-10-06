import api from '../lib/axios'

export interface SignupRequest {
  email: string
  password: string
  nickname: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

export const authApi = {
  signup: (data: SignupRequest) =>
    api.post<{ success: boolean; message: string; data: TokenResponse }>('/api/auth/signup', data),

  login: (data: LoginRequest) =>
    api.post<{ success: boolean; message: string; data: TokenResponse }>('/api/auth/login', data),

  refresh: (refreshToken: string) =>
    api.post<{ success: boolean; data: TokenResponse }>('/api/auth/refresh', { refreshToken }),

  logout: () =>
    api.post<{ success: boolean; message: string }>('/api/auth/logout'),

  // 이메일 인증 링크의 토큰으로 인증 완료 (비로그인 상태도 가능)
  verifyEmail: (token: string) =>
    api.post<{ success: boolean; message: string }>('/api/auth/email/verify', { token }),

  // 인증 메일 재발송 (로그인 필수)
  resendVerification: () =>
    api.post<{ success: boolean; message: string }>('/api/auth/email/resend'),

  // 비밀번호 찾기 — 가입 여부와 무관하게 항상 같은 성공 응답(가입 여부 노출 방지)
  forgotPassword: (email: string) =>
    api.post<{ success: boolean; message: string }>('/api/auth/password/forgot', { email }),

  // 메일 링크의 토큰으로 새 비밀번호 설정 — 성공 시 모든 기기 로그아웃
  resetPassword: (token: string, newPassword: string) =>
    api.post<{ success: boolean; message: string }>('/api/auth/password/reset', { token, newPassword }),
}
