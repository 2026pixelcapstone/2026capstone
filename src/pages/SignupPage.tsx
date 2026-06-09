import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { userApi } from '../api/userApi'
import { useAuthStore } from '../store/authStore'

function getPwStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const STRENGTH_COLORS = ['#f85149', '#f59e0b', '#60a5fa', '#3fb950']
const STRENGTH_LABELS = ['약함', '보통', '강함', '매우 강함']

export default function SignupPage() {
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [allTerms, setAllTerms] = useState(false)
  const [terms, setTerms] = useState([false, false, false])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()

  const usernameValid = /^[a-z0-9_]{4,20}$/.test(username)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const pwStrength = password.length > 0 ? getPwStrength(password) : 0
  const confirmMatch = confirm.length > 0 && confirm === password

  const toggleAllTerms = (checked: boolean) => {
    setAllTerms(checked)
    setTerms([checked, checked, checked])
  }
  const toggleTerm = (i: number, checked: boolean) => {
    const next = terms.map((v, idx) => idx === i ? checked : v)
    setTerms(next)
    setAllTerms(next.every(v => v))
  }

  const canSubmit = usernameValid && emailValid && pwStrength >= 1 && confirmMatch && terms[0] && terms[1]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      const res = await authApi.signup({ email, password, nickname: username })
      const { accessToken, refreshToken } = res.data.data
      setTokens(accessToken, refreshToken)
      try {
        const meRes = await userApi.getMe()
        const { userId, email: userEmail, nickname, role, profileImageUrl, emailVerified } = meRes.data.data
        setUser({ userId, email: userEmail, nickname, role, profileImageUrl: profileImageUrl ?? undefined, emailVerified })
      } catch { /* MainLayout에서 재시도 */ }
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message ?? '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-x-hidden py-8"
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
          style={{ background: '#21262d', border: '1px solid #30363d' }}>
          <h1 className="text-2xl font-bold mb-1">회원가입</h1>
          <p className="text-sm mb-8" style={{ color: '#7d8590' }}>무료로 시작하세요. 언제든 취소 가능해요.</p>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* 사용자 이름 */}
            <div>
              <label className="block text-sm font-bold mb-1.5">
                사용자 이름 <span style={{ color: '#f85149' }}>*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg"
                  style={{ color: '#7d8590' }}>alternate_email</span>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="pixelartist_kim"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: '#1c2128',
                    border: `1px solid ${username.length === 0 ? '#30363d' : usernameValid ? '#3fb950' : '#f85149'}`,
                    color: '#e6edf3'
                  }} />
                {username.length > 0 && (
                  <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-lg"
                    style={{ color: usernameValid ? '#3fb950' : '#f85149' }}>
                    {usernameValid ? 'check_circle' : 'cancel'}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1.5 px-1"
                style={{ color: username.length === 0 ? '#7d8590' : usernameValid ? '#3fb950' : '#f85149' }}>
                {username.length === 0
                  ? '영문 소문자, 숫자, 언더바(_) · 4~20자'
                  : usernameValid ? '사용 가능한 이름입니다.' : '영문 소문자, 숫자, 언더바(_)만 · 4~20자'}
              </p>
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-bold mb-1.5">
                이메일 <span style={{ color: '#f85149' }}>*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg"
                  style={{ color: '#7d8590' }}>mail</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@pixelhub.io"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: '#1c2128',
                    border: `1px solid ${email.length === 0 ? '#30363d' : emailValid ? '#3fb950' : '#f85149'}`,
                    color: '#e6edf3'
                  }} />
                {email.length > 0 && (
                  <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-lg"
                    style={{ color: emailValid ? '#3fb950' : '#f85149' }}>
                    {emailValid ? 'check_circle' : 'cancel'}
                  </span>
                )}
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-bold mb-1.5">
                비밀번호 <span style={{ color: '#f85149' }}>*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg"
                  style={{ color: '#7d8590' }}>lock</span>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="8자 이상 입력"
                  className="w-full pl-10 pr-12 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#7d8590' }}>
                  <span className="material-symbols-outlined text-lg">{showPw ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {/* 강도 바 */}
              <div className="mt-2 px-1">
                <div className="flex gap-1 mb-1">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="flex-1 rounded-full transition-all" style={{ height: 3,
                      background: i < pwStrength ? STRENGTH_COLORS[pwStrength - 1] : '#30363d' }} />
                  ))}
                </div>
                <p className="text-xs" style={{ color: '#7d8590' }}>
                  {password.length === 0 ? '비밀번호를 입력하세요' : `비밀번호 강도: ${STRENGTH_LABELS[pwStrength - 1]}`}
                </p>
              </div>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-bold mb-1.5">
                비밀번호 확인 <span style={{ color: '#f85149' }}>*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg"
                  style={{ color: '#7d8590' }}>lock_reset</span>
                <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="비밀번호 재입력"
                  className="w-full pl-10 pr-12 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }} />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#7d8590' }}>
                  <span className="material-symbols-outlined text-lg">{showConfirm ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {confirm.length > 0 && (
                <p className="text-xs mt-1.5 px-1" style={{ color: confirmMatch ? '#3fb950' : '#f85149' }}>
                  {confirmMatch ? '✓ 비밀번호가 일치합니다.' : '✕ 비밀번호가 일치하지 않습니다.'}
                </p>
              )}
            </div>

            {/* 약관 동의 */}
            <div className="space-y-2.5 pt-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={allTerms} onChange={e => toggleAllTerms(e.target.checked)}
                  className="w-4 h-4 accent-[#2f81f7]" />
                <span className="text-sm font-bold">전체 동의</span>
              </label>
              <div className="ml-7 space-y-2 border-t pt-2.5" style={{ borderColor: '#30363d' }}>
                {[
                  { prefix: '[필수]', label: '서비스 이용약관 동의', required: true },
                  { prefix: '[필수]', label: '개인정보 수집 및 이용 동의', required: true },
                  { prefix: '[선택]', label: '마케팅 정보 수신 동의', required: false },
                ].map((item, i) => (
                  <label key={i} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={terms[i]} onChange={e => toggleTerm(i, e.target.checked)}
                      className="w-4 h-4 accent-[#2f81f7]" />
                    <span className="text-sm flex-1" style={{ color: '#7d8590' }}>
                      <span className="font-bold mr-1" style={{ color: item.required ? '#f85149' : '#7d8590' }}>
                        {item.prefix}
                      </span>
                      {item.label}
                      {item.required && (
                        <a href="#" className="hover:underline ml-1 text-xs" style={{ color: '#2f81f7' }}>보기</a>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm px-1" style={{ color: '#f85149' }}>{error}</p>
            )}

            <button type="submit" disabled={!canSubmit || loading}
              className="w-full py-3.5 rounded-xl font-bold text-base hover:opacity-90 active:scale-[0.98] transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#2f81f7', color: '#fff' }}>
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: '#7d8590' }}>
            이미 계정이 있으신가요?
            <Link to="/login" className="font-bold hover:underline ml-1" style={{ color: '#2f81f7' }}>로그인</Link>
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
