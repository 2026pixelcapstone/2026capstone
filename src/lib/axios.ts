import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
  headers: { 'Content-Type': 'application/json' },
})

// 요청 인터셉터 — accessToken 자동 첨부
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth-storage')
  if (raw) {
    try {
      const state = JSON.parse(raw)
      const token = state?.state?.accessToken
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // 파싱 실패 시 무시
    }
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
      const raw = localStorage.getItem('auth-storage')
      const refreshToken = raw ? JSON.parse(raw)?.state?.refreshToken : null

      if (!refreshToken) throw new Error('no refresh token')

      const res = await axios.post(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/auth/refresh`, { refreshToken })
      const { accessToken, refreshToken: newRefresh } = res.data.data

      // 스토어 갱신 (zustand persist)
      const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}')
      stored.state = { ...stored.state, accessToken, refreshToken: newRefresh }
      localStorage.setItem('auth-storage', JSON.stringify(stored))

      refreshQueue.forEach((cb) => cb(accessToken))
      refreshQueue = []

      original.headers.Authorization = `Bearer ${accessToken}`
      return api(original)
    } catch {
      // refresh 실패 → 로그아웃 처리
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
