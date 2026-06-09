import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userApi } from '../api/userApi'
import { useAuthStore } from '../store/authStore'

/**
 * 소셜 로그인 콜백. 백엔드가 /oauth2/callback?accessToken=..&refreshToken=.. 로 리다이렉트하면
 * 토큰을 저장하고 즉시 URL에서 제거(주소창/히스토리 잔존 방지) → 사용자 정보 로드 → 홈 이동.
 * ⚠️ 쿼리 토큰 전달은 임시 방식 — 추후 일회용 코드/httpOnly 쿠키로 개선 예정.
 */
export default function OAuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const ranRef = useRef(false)   // 토큰 1회 처리 가드

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')

    if (!accessToken || !refreshToken) {
      navigate('/login?error=oauth', { replace: true })
      return
    }

    setTokens(accessToken, refreshToken)
    // 토큰을 주소창/히스토리에서 즉시 제거
    window.history.replaceState(null, '', '/oauth2/callback')

    userApi.getMe()
      .then(res => {
        const { userId, email, nickname, role, profileImageUrl, emailVerified } = res.data.data
        setUser({ userId, email, nickname, role, profileImageUrl: profileImageUrl ?? undefined, emailVerified: emailVerified ?? false })
      })
      .catch(() => { /* 유저 정보 로드 실패해도 토큰은 있음 — MainLayout에서 재시도 */ })
      .finally(() => navigate('/', { replace: true }))
  }, [params, navigate, setTokens, setUser])

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full w-10 h-10 border-2"
          style={{ borderColor: '#2f81f7', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: '#7d8590' }}>로그인 처리 중…</p>
      </div>
    </div>
  )
}
