import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
})

// 요청 인터셉터 — accessToken 자동 첨부 (스토어를 단일 출처로)
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 응답 인터셉터 — 401 발생 시 refresh 후 재시도
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // 이미 refresh 중이면 큐에 대기
      return new Promise((resolve) => {
        refreshQueue.push((newToken: string) => {
          original.headers.Authorization = `Bearer ${newToken}`
          resolve(api(original))
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) throw new Error('no refresh token')

      const res = await axios.post(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/auth/refresh`,
        { refreshToken },
      )
      const { accessToken, refreshToken: newRefresh } = res.data.data

      // 스토어를 통해 갱신 → 메모리/localStorage 일치(직접 조작 시 옛 토큰이 덮어쓰던 버그 방지)
      useAuthStore.getState().setTokens(accessToken, newRefresh)

      refreshQueue.forEach((cb) => cb(accessToken))
      refreshQueue = []

      original.headers.Authorization = `Bearer ${accessToken}`
      return api(original)
    } catch (refreshError) {
      // refresh 실패 → 로그아웃 처리 (스토어 경유)
      refreshQueue = []
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
