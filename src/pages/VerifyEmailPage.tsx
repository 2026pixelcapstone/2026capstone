import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { userApi } from '../api/userApi'
import { useAuthStore } from '../store/authStore'
import { getErrorMessage } from '../lib/errorUtils'

type Status = 'loading' | 'success' | 'error'

/**
 * 이메일 인증 링크 도착 페이지. /verify-email?token=... 의 토큰을 서버에 검증 요청.
 * 로그인 상태면 인증 성공 후 /me를 다시 받아 배너를 즉시 해제.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const { isLoggedIn, setUser } = useAuthStore()
  // 처리한 토큰을 기억 — StrictMode 이중 실행은 막되, 토큰이 바뀌면 재검증 허용.
  // 초기값 undefined: token이 null이어도 첫 실행이 막히지 않도록(string|null과 구분)
  const processedTokenRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (processedTokenRef.current === token) return
    processedTokenRef.current = token

    if (!token) {
      setStatus('error')
      setMessage('인증 토큰이 없는 링크입니다.')
      return
    }

    setStatus('loading')   // 새 토큰 처리 시작 — 이전 결과 초기화
    authApi.verifyEmail(token)
      .then(async () => {
        setStatus('success')
        setMessage('이메일 인증이 완료되었습니다.')
        // 로그인 상태라면 사용자 정보 갱신 → 인증 배너 즉시 해제
        if (isLoggedIn) {
          try {
            const me = await userApi.getMe()
            const { userId, email, nickname, role, profileImageUrl, emailVerified } = me.data.data
            setUser({ userId, email, nickname, role, profileImageUrl: profileImageUrl ?? undefined, emailVerified })
          } catch { /* 갱신 실패는 무시 — 다음 로드 시 반영 */ }
        }
      })
      .catch(err => {
        setStatus('error')
        setMessage(getErrorMessage(err, '인증에 실패했습니다. 링크가 만료되었거나 잘못되었습니다.'))
      })
  }, [token, isLoggedIn, setUser])

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{ background: '#161b22', borderColor: '#30363d' }}>
        {status === 'loading' && (
          <>
            <div className="mx-auto mb-5 animate-spin rounded-full w-10 h-10 border-2"
              style={{ borderColor: '#2f81f7', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#7d8590' }}>이메일 인증을 확인하는 중…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <span className="material-symbols-outlined text-5xl" style={{ color: '#3fb950' }}>
              check_circle
            </span>
            <h1 className="mt-3 text-xl font-bold">인증 완료</h1>
            <p className="mt-2 text-sm" style={{ color: '#7d8590' }}>{message}</p>
            <Link to="/"
              className="inline-block mt-6 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
              style={{ background: '#2f81f7', color: '#fff' }}>
              홈으로 가기
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <span className="material-symbols-outlined text-5xl" style={{ color: '#f85149' }}>
              error
            </span>
            <h1 className="mt-3 text-xl font-bold">인증 실패</h1>
            <p className="mt-2 text-sm" style={{ color: '#7d8590' }}>{message}</p>
            <p className="mt-1 text-xs" style={{ color: '#484f58' }}>
              로그인 후 상단 배너에서 인증 메일을 다시 받을 수 있습니다.
            </p>
            <Link to="/"
              className="inline-block mt-6 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
              style={{ background: '#21262d', color: '#e6edf3', border: '1px solid #30363d' }}>
              홈으로 가기
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
