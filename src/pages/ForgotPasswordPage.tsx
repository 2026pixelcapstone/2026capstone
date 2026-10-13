import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { getErrorMessage } from '../lib/errorUtils'

/**
 * 비밀번호 찾기 — 이메일로 재설정 링크 요청.
 * 서버는 가입 여부와 무관하게 같은 응답을 주므로 화면도 항상 같은 안내(가입 여부 노출 방지).
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!email.trim()) { setError('이메일을 입력해주세요.'); return }
    setSubmitting(true)
    setError('')
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(getErrorMessage(err, '요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="w-full max-w-md rounded-2xl border p-8"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
        {sent ? (
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-primary)' }}>mark_email_read</span>
            <h1 className="mt-3 text-xl font-bold">메일을 확인해 주세요</h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              가입된 이메일이라면 비밀번호 재설정 링크를 보냈습니다.<br />
              링크는 30분 동안 한 번만 사용할 수 있어요.
            </p>
            <p className="mt-3 text-xs" style={{ color: 'var(--color-outline-strong)' }}>
              메일이 오지 않으면 스팸함을 확인하거나 1분 뒤 다시 요청해 주세요.
              Google로 가입한 계정은 비밀번호가 없어 메일이 가지 않습니다.
            </p>
            <Link to="/login"
              className="inline-block mt-6 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1">비밀번호 찾기</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
              가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드려요.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-bold mb-1.5">이메일</label>
                <input id="forgot-email" type="email" autoComplete="email" placeholder="example@pixelhub.io"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
              </div>
              {error && <p role="alert" className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>}
              <button type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                {submitting ? '요청 중...' : '재설정 링크 받기'}
              </button>
            </form>
            <p className="text-center text-sm mt-6">
              <Link to="/login" className="hover:underline" style={{ color: 'var(--color-on-surface-variant)' }}>로그인으로 돌아가기</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
