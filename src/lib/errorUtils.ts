import axios from 'axios'

/** axios 에러에서 백엔드 message 추출, 없으면 fallback 반환 */
export function getErrorMessage(error: unknown, fallback = '오류가 발생했습니다.'): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

/** axios 에러의 HTTP 상태 코드 반환, 아니면 null */
export function getErrorStatus(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null
  }
  return null
}
