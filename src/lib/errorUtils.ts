import axios from 'axios'

/** axios 에러에서 백엔드 message 추출, 없으면 fallback 반환 */
export function getErrorMessage(error: unknown, fallback = '오류가 발생했습니다.'): string {
  if (axios.isAxiosError(error)) {
    // 응답 대기 상한(lib/axios timeout)을 넘김 — 서버 문제일 수 있어 다시 시도를 안내
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return '서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.'
    }
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
