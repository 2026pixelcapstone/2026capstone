import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** accessToken의 exp를 디코드해 만료 여부 판정. 파싱 불가/누락은 만료로 간주(30초 스큐 여유). */
function isAccessTokenExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (typeof payload.exp !== 'number') return true
    return payload.exp * 1000 <= Date.now() + 30_000
  } catch {
    return true
  }
}

/**
 * 앱 시작 시 세션 검증 — persist된 로그인 상태의 accessToken이 만료됐고 refreshToken이 있으면
 * 렌더 전에 선제적으로 재발급한다. 실패하면 로그아웃해서 "로그인 표시는 남았는데 기능은 막힘"
 * (stale 세션) 상태를 없앤다. 렌더 전에 끝내므로 인터셉터 리프레시와 동시 실행되지 않는다.
 */
export async function bootstrapAuth(): Promise<void> {
  const { isLoggedIn, accessToken, refreshToken } = useAuthStore.getState()
  if (!isLoggedIn) return
  if (!isAccessTokenExpired(accessToken)) return   // 아직 유효 → 그대로 진행
  if (!refreshToken) { useAuthStore.getState().logout(); return }

  try {
    const res = await axios.post(
      `${API_URL}/api/auth/refresh`,
      { refreshToken },
      { timeout: 8000 },   // 네트워크 지연 시 렌더가 무한 대기하지 않도록
    )
    const { accessToken: newAccess, refreshToken: newRefresh } = res.data.data
    useAuthStore.getState().setTokens(newAccess, newRefresh)
  } catch {
    // refreshToken 만료/무효/네트워크 실패 → 로그아웃(UI를 실제 상태와 일치시킴)
    useAuthStore.getState().logout()
  }
}
