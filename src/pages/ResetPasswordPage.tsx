import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../store/authStore'
import { getErrorMessage } from '../lib/errorUtils'

const MIN_PASSWORD = 8   // 서버 가입 규칙과 동일(8~100자)

/**
 * 비밀번호 재설정 — /reset-password?token=... (메일 링크 도착 페이지).
 * 토큰은 처음 한 번 읽어 state에 두고 주소창에서 바로 지운다(기록·공유·리퍼러로 새는 것 방지, OAuth 콜백과 같은 방식).
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [token] = useState(() => params.get('token'))
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [linkFailed, setLinkFailed] = useState(false)   // 서버가 거절(만료·사용됨 등) — '다시 받기' 안내는 이때만

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', '/reset-password')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || !token) return
    setLinkFailed(false)
    if (password.length < MIN_PASSWORD) { setError(`비밀번호는 ${MIN_PASSWORD}자 이상 입력해주세요.`); return }
    if (password !== confirm) { setError('새 비밀번호가 서로 다릅니다.'); return }
    setSubmitting(true)
    setError('')
    setLinkFailed(false)
    try {
      await authApi.resetPassword(token, password)
      // 서버가 모든 기기의 로그인을 끊었으므로 이 브라우저의 로그인 상태도 정리
      useAuthStore.getState().logout()
      setDone(true)
    } catch (err) {
      setError(getErrorMessage(err, '비밀번호를 바꾸지 못했습니다. 링크가 만료되었거나 이미 사용되었을 수 있어요.'))
      setLinkFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = { background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="w-full max-w-md rounded-2xl border p-8"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
        {!token ? (
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-error)' }}>link_off</span>
            <h1 className="mt-3 text-xl font-bold">잘못된 링크</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>재설정 토큰이 없는 링크입니다.</p>
            <Link to="/forgot-password"
              className="inline-block mt-6 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              비밀번호 찾기 다시 요청
            </Link>
          </div>
        ) : done ? (
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-success)' }}>check_circle</span>
            <h1 className="mt-3 text-xl font-bold">비밀번호를 바꿨어요</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              보안을 위해 모든 기기에서 로그아웃되었습니다. 새 비밀번호로 로그인해 주세요.
            </p>
            <Link to="/login"
              className="inline-block mt-6 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              로그인하기
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1">새 비밀번호 설정</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
              새 비밀번호를 입력해 주세요. 바꾸면 모든 기기에서 로그아웃됩니다.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-new" className="block text-sm font-bold mb-1.5">새 비밀번호</label>
                <input id="reset-new" type="password" autoComplete="new-password" placeholder={`${MIN_PASSWORD}자 이상`}
                  value={password} onChange={e => setPassword(e.target.value)} maxLength={100}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="reset-confirm" className="block text-sm font-bold mb-1.5">새 비밀번호 확인</label>
                <input id="reset-confirm" type="password" autoComplete="new-password"
                  value={confirm} onChange={e => setConfirm(e.target.value)} maxLength={100}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              {error && (
                <div role="alert" className="text-sm" style={{ color: 'var(--color-error)' }}>
                  {error}
                  {linkFailed && <Link to="/forgot-password" className="block mt-1 font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
                    재설정 링크 다시 받기
                  </Link>}
                </div>
              )}
              <button type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                {submitting ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
