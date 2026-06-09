import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { userApi } from '../api/userApi'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from ?? '/'

  // 소셜 로그인 — 백엔드 OAuth2 엔드포인트로 전체 페이지 이동(이후 /oauth2/callback으로 복귀)
  const handleGoogleLogin = () => {
    const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
    window.location.href = `${apiBase}/oauth2/authorization/google`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      const { accessToken, refreshToken } = res.data.data
      setTokens(accessToken, refreshToken)
      // 로그인 직후 유저 정보 즉시 로드 (삭제 버튼 등 본인 확인 로직에 필요)
      try {
        const meRes = await userApi.getMe()
        const { userId, email: userEmail, nickname, role, profileImageUrl, emailVerified } = meRes.data.data
        setUser({ userId, email: userEmail, nickname, role, profileImageUrl: profileImageUrl ?? undefined, emailVerified })
      } catch {
        // 유저 정보 로드 실패해도 로그인 자체는 유지 (MainLayout에서 재시도)
      }
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message ?? '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#0d1117', color: '#e6edf3' }}>
      {/* 픽셀 도트 배경 */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ backgroundColor: '#0f0e1a', backgroundImage: 'radial-gradient(circle, #2f81f7 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(47,129,247,0.1) 0%, transparent 50%, #0d1117 100%)' }} />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* 로고 */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-3xl font-bold hover:opacity-80 transition-opacity"
            style={{ color: '#2f81f7' }}>
            <span className="material-symbols-outlined text-3xl">grid_view</span>
            PixelHub
          </Link>
          <p className="text-sm mt-2" style={{ color: '#7d8590' }}>픽셀 아트 크리에이터 커뮤니티</p>
        </div>

        {/* 카드 */}
        <div className="rounded-2xl p-8 shadow-2xl"
          style={{ background: '#21262d', border: '1px solid #21262d' }}>
          <h1 className="text-2xl font-bold mb-1">로그인</h1>
          <p className="text-sm mb-8" style={{ color: '#7d8590' }}>계속하려면 로그인하세요.</p>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-bold mb-1.5">이메일</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg"
                  style={{ color: '#7d8590' }}>mail</span>
                <input type="email" placeholder="example@pixelhub.io"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">비밀번호</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg"
                  style={{ color: '#7d8590' }}>lock</span>
                <input type={showPw ? 'text' : 'password'} placeholder="비밀번호 입력"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#7d8590' }}>
                  <span className="material-symbols-outlined text-lg">
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm px-1" style={{ color: '#f85149' }}>{error}</p>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#2f81f7]" />
                <span className="text-sm" style={{ color: '#7d8590' }}>로그인 상태 유지</span>
              </label>
              <a href="#" className="text-sm font-bold hover:underline" style={{ color: '#2f81f7' }}>비밀번호 찾기</a>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#2f81f7', color: '#fff' }}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px" style={{ background: '#21262d' }} />
            <span className="text-xs font-bold" style={{ color: '#7d8590' }}>또는</span>
            <div className="flex-1 h-px" style={{ background: '#21262d' }} />
          </div>

          <button type="button" onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-bold hover:opacity-90"
            style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }}>
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google로 계속하기
          </button>

          <p className="text-center text-sm mt-6" style={{ color: '#7d8590' }}>
            계정이 없으신가요?
            <Link to="/signup" className="font-bold hover:underline ml-1" style={{ color: '#2f81f7' }}>회원가입</Link>
          </p>
        </div>

        <p className="text-center mt-6">
          <Link to="/" className="flex items-center justify-center gap-1 text-sm transition-colors hover:text-[#2f81f7]"
            style={{ color: '#7d8590' }}>
            <span className="material-symbols-outlined text-base">arrow_back</span>
            메인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  )
}
