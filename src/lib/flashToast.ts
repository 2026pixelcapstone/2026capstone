import { toast } from '../store/toastStore'

const KEY = 'flash-toast'

/**
 * 페이지를 새로 불러온 뒤에 보여 줄 토스트 한 번(탈퇴처럼 전체 새로고침으로 이동하는 경우용).
 * sessionStorage라 이 탭에서만, 읽으면 바로 지움. 저장소를 못 쓰면 조용히 생략.
 */
export function setFlashToast(message: string) {
  try { sessionStorage.setItem(KEY, message) } catch { /* 저장소 사용 불가 — 토스트만 생략 */ }
}

export function showFlashToast() {
  try {
    const message = sessionStorage.getItem(KEY)
    if (message) {
      sessionStorage.removeItem(KEY)
      toast.success(message)
    }
  } catch { /* 저장소 사용 불가 */ }
}
