import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { paymentApi } from '../api/paymentApi'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'

/**
 * 결제 성공 콜백. 토스 인증 후 successUrl?paymentKey=&orderId=&amount= 로 돌아오면
 * 서버 승인(confirm)을 호출한다. 성공 시 결제 HELD + 커미션 IN_PROGRESS → 거래룸으로 이동.
 * ⚠️ 실제 카드 청구는 이 confirm 시점에 일어난다(인증만으론 미결제).
 */
export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const ranRef = useRef(false)   // confirm 1회 처리 가드(중복 승인 방지)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const paymentKey = params.get('paymentKey')
    const orderId = params.get('orderId')
    const amount = Number(params.get('amount'))

    // 형식 검증(빈 값·비숫자·음수 차단). 실제 금액 위변조는 서버가 저장값과 대조해 최종 판정한다.
    if (!paymentKey || !orderId || !Number.isSafeInteger(amount) || amount <= 0) {
      setError('결제 정보가 올바르지 않습니다.')
      return
    }

    paymentApi.confirm({ paymentKey, orderId, amount })
      .then(res => {
        const { commissionId } = res.data.data
        toast.success('결제가 완료되었습니다. 작업이 시작됩니다.')
        navigate(`/commission/${commissionId}`, { replace: true })
      })
      .catch(err => {
        setError(getErrorMessage(err, '결제 승인에 실패했습니다.'))
      })
  }, [params, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      {error ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-error)' }}>error</span>
          <p className="font-bold">결제를 완료하지 못했습니다</p>
          <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{error}</p>
          <Link to="/commission?tab=mine" replace
            className="mt-2 px-5 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: 'var(--color-primary)', color: '#fff' }}>
            내 커미션으로
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full w-10 h-10 border-2"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>결제 승인 중…</p>
        </div>
      )}
    </div>
  )
}
