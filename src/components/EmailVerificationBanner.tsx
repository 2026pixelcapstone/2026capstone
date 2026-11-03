import { useEffect, useState } from 'react'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'

/** 서버 재발송 간격(EmailVerificationService.RESEND_COOLDOWN_SECONDS)과 같게 — 버튼을 그동안 잠가 헛클릭(429)을 줄임 */
const RESEND_COOLDOWN_SECONDS = 60

/**
 * 이메일 미인증 사용자에게 보이는 상단 배너 (소프트 게이트 안내 + 재발송).
 * 로그인 상태이고 emailVerified === false 일 때만 노출.
 * 재발송 제한(1분·24시간 5번)은 서버가 판정하고, 여기선 보낸 뒤 1분 동안 버튼만 잠근다(새로고침하면 풀림 — 서버가 다시 막음).
 */
export default function EmailVerificationBanner() {
  const { isLoggedIn, user } = useAuthStore()
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)   // 남은 초

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // emailVerified가 명시적으로 false일 때만 노출 (undefined=정보 없음 → 숨김)
  if (!isLoggedIn || !user || user.emailVerified !== false) return null

  const handleResend = async () => {
    if (sending || cooldown > 0) return
    setSending(true)
    try {
      await authApi.resendVerification()
      toast.success('인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      // 429 = 1분 간격 또는 24시간 5번 제한 — 서버 문구를 그대로 보여 주고 버튼은 1분 잠금
      if (getErrorStatus(err) === 429) setCooldown(RESEND_COOLDOWN_SECONDS)
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
      <button type="button" onClick={handleResend} disabled={sending || cooldown > 0}
        className="ml-1 px-3 py-1 rounded-full font-bold text-xs hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: 'var(--color-background)' }}>
        {sending ? '발송 중…' : cooldown > 0 ? `다시 보내기 (${cooldown}초)` : '인증 메일 재발송'}
      </button>
    </div>
  )
}
