import { useState } from 'react'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'

/**
 * 이메일 미인증 사용자에게 보이는 상단 배너 (소프트 게이트 안내 + 재발송).
 * 로그인 상태이고 emailVerified === false 일 때만 노출.
 */
export default function EmailVerificationBanner() {
  const { isLoggedIn, user } = useAuthStore()
  const [sending, setSending] = useState(false)

  // emailVerified가 명시적으로 false일 때만 노출 (undefined=정보 없음 → 숨김)
  if (!isLoggedIn || !user || user.emailVerified !== false) return null

  const handleResend = async () => {
    if (sending) return
    setSending(true)
    try {
      await authApi.resendVerification()
      toast.success('인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요.')
    } catch (err) {
      toast.error(getErrorMessage(err, '인증 메일 재발송에 실패했습니다.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="w-full flex items-center justify-center gap-3 px-4 py-2 text-sm"
      style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)', color: 'var(--color-accent)' }}>
      <span className="material-symbols-outlined text-base">mark_email_unread</span>
      <span className="font-medium">
        이메일 인증이 필요합니다. 작품·에셋·커미션 등록 등 일부 기능이 제한됩니다.
      </span>
      <button type="button" onClick={handleResend} disabled={sending}
        className="ml-1 px-3 py-1 rounded-full font-bold text-xs hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: 'var(--color-background)' }}>
        {sending ? '발송 중…' : '인증 메일 재발송'}
      </button>
    </div>
  )
}
