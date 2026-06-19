import { useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'

// 이메일 미인증 사용자의 콘텐츠 생성(갤러리/에셋/에디터/커미션)을 사전 차단하는 공용 훅.
// 진짜 disabled 대신 aria-disabled + title을 쓰는 이유: disabled 버튼은 마우스 이벤트를
// 받지 못해 호버 툴팁이 안 뜨기 때문. (시각적으로만 비활성 + 호버 안내 + 클릭 무력화)
export const EMAIL_GATE_MESSAGE =
  '이메일 인증 후 이용할 수 있습니다. 상단 배너에서 인증 메일을 재발송하세요.'

export function useEmailGate() {
  const { isLoggedIn, user } = useAuthStore()
  // emailVerified === false(명시적 미인증)일 때만 차단. undefined(정보 없음)는 차단 안 함.
  const blocked = isLoggedIn && user?.emailVerified === false

  // 실제 핸들러를 감싸 차단 시 안내 토스트만 띄우고 실행을 막는다.
  const guard = useCallback(
    (run: () => void) => () => {
      if (blocked) { toast.error(EMAIL_GATE_MESSAGE); return }
      run()
    },
    [blocked],
  )

  // 버튼/링크에 펼쳐 넣을 접근성 속성 + 호버 툴팁
  const gateProps = blocked
    ? ({ 'aria-disabled': true, title: EMAIL_GATE_MESSAGE } as const)
    : {}

  return { blocked, guard, gateProps, message: EMAIL_GATE_MESSAGE }
}
