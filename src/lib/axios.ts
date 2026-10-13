import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// 응답 대기 상한 — 서버가 응답 없이 멈춰도 요청이 끝나 '저장 중' 버튼·모달이 풀리게
export const DEFAULT_TIMEOUT_MS = 20_000
export const UPLOAD_TIMEOUT_MS = 5 * 60_000   // 파일 업로드(FormData·Blob 본문)는 큰 파일을 고려해 길게
// AI 호출은 서버의 Gemini 대기(GeminiClient READ_TIMEOUT 30초) + 처리 여유. 서버 쪽을 늘리면 이것도 함께
export const AI_TIMEOUT_MS = 60_000
const REFRESH_TIMEOUT_MS = 10_000

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
  timeout: DEFAULT_TIMEOUT_MS,
})

// 요청 인터셉터 — accessToken 자동 첨부 (스토어를 단일 출처로)
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // 파일 업로드는 호출부를 고치지 않고 여기서 상한을 늘림(호출부가 따로 정한 값은 그대로)
  // FormData 뿐 아니라 파일(Blob·File)을 본문으로 그대로 보내는 요청도 업로드로 본다
  const isUpload = config.data instanceof FormData || config.data instanceof Blob
  if (isUpload && config.timeout === DEFAULT_TIMEOUT_MS) {
    config.timeout = UPLOAD_TIMEOUT_MS
  }
  return config
})

// 응답 인터셉터 — 401 발생 시 refresh 후 재시도
let isRefreshing = false
// refresh 를 기다리는 요청들 — 성공하면 새 토큰으로 재시도, 실패하면 같이 실패(끝없이 대기하지 않게)
let refreshQueue: Array<{ resume: (token: string) => void; fail: (err: unknown) => void }> = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // 이미 refresh 중이면 큐에 대기
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resume: (newToken: string) => {
            original.headers.Authorization = `Bearer ${newToken}`
            resolve(api(original))
          },
          fail: reject,
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
        { timeout: REFRESH_TIMEOUT_MS },
      )
      const { accessToken, refreshToken: newRefresh } = res.data.data

      // 스토어를 통해 갱신 → 메모리/localStorage 일치(직접 조작 시 옛 토큰이 덮어쓰던 버그 방지)
      useAuthStore.getState().setTokens(accessToken, newRefresh)

      refreshQueue.forEach((q) => q.resume(accessToken))
      refreshQueue = []

      original.headers.Authorization = `Bearer ${accessToken}`
      return api(original)
    } catch (refreshError) {
      refreshQueue.forEach((q) => q.fail(refreshError))
      refreshQueue = []
      // 응답 자체가 없음(시간 초과·네트워크 끊김) → 토큰이 무효라는 뜻이 아니므로 로그아웃하지 않고 실패만 전달
      if (axios.isAxiosError(refreshError) && !refreshError.response) {
        return Promise.reject(refreshError)
      }
      // refresh 거절(만료·무효) → 로그아웃 처리 (스토어 경유)
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
