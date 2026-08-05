import { useSearchParams, Link } from 'react-router-dom'

/**
 * 결제 실패/취소 콜백. 토스가 failUrl?code=&message=&orderId= 로 리다이렉트한다.
 * 실제 청구는 일어나지 않은 상태(승인 전) — 안내만 하고 돌아갈 링크 제공.
 */
export default function PaymentFailPage() {
  const [params] = useSearchParams()
  const message = params.get('message') || '결제가 취소되었거나 실패했습니다.'
  const code = params.get('code')

  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-error)' }}>cancel</span>
        <p className="font-bold">결제가 완료되지 않았습니다</p>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{message}</p>
        {code && <p className="text-xs" style={{ color: 'var(--color-outline-strong)' }}>오류 코드: {code}</p>}
        <Link to="/commission?tab=mine"
          className="mt-2 px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: 'var(--color-primary)', color: '#fff' }}>
          내 커미션으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
