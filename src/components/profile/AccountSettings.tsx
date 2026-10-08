import { useState } from 'react'
import { Link } from 'react-router-dom'
import { userApi } from '../../api/userApi'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { getErrorMessage } from '../../lib/errorUtils'

const MIN_PASSWORD = 8   // 서버 가입 규칙과 동일(8~100자)

interface AccountSettingsProps {
  email: string | undefined
  /** 비밀번호 로그인 가능 여부 — false면 소셜 전용 계정. 아직 모르면 null/undefined */
  hasPassword: boolean | null | undefined
}

/** 마이페이지 '계정 설정' 탭 — 비밀번호 변경(회원 탈퇴는 추후 이 탭에 추가 예정) */
export default function AccountSettings({ email, hasPassword }: AccountSettingsProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!current) { setError('현재 비밀번호를 입력해주세요.'); return }
    if (next.length < MIN_PASSWORD) { setError(`새 비밀번호는 ${MIN_PASSWORD}자 이상 입력해주세요.`); return }
    if (next !== confirm) { setError('새 비밀번호가 서로 다릅니다.'); return }
    if (next === current) { setError('새 비밀번호가 현재 비밀번호와 같습니다.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await userApi.changePassword(current, next)
      // 서버가 모든 refresh 토큰을 폐기하고 이 기기용 새 토큰을 줌 → 바로 교체해야 이 기기 로그인이 유지됨
      const { accessToken, refreshToken } = res.data.data
      useAuthStore.getState().setTokens(accessToken, refreshToken)
      setCurrent(''); setNext(''); setConfirm('')
      toast.success('비밀번호를 변경했습니다. 다른 기기에서는 로그아웃됩니다.')
    } catch (err) {
      setError(getErrorMessage(err, '비밀번호 변경에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = { background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }

  return (
    <div className="max-w-md space-y-6">
      <section className="rounded-xl border p-5"
        style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
        <h3 className="font-bold text-sm mb-1">로그인 이메일</h3>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{email ?? '—'}</p>
      </section>

      <section className="rounded-xl border p-5"
        style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
        <h3 className="font-bold text-sm mb-4">비밀번호 변경</h3>

        {hasPassword == null ? (
          <div className="h-24 rounded-lg animate-pulse" style={{ background: 'var(--color-surface-container-high)' }} />
        ) : !hasPassword ? (
          <p className="text-sm flex gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
            <span className="material-symbols-outlined text-base">info</span>
            Google 계정으로 로그인 중이라 비밀번호가 없습니다. 로그인은 Google에서 관리돼요.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="pw-current" className="block text-xs font-bold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>현재 비밀번호</label>
              <input id="pw-current" type="password" autoComplete="current-password" value={current}
                onChange={e => setCurrent(e.target.value)} maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="pw-new" className="block text-xs font-bold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>새 비밀번호</label>
              <input id="pw-new" type="password" autoComplete="new-password" placeholder={`${MIN_PASSWORD}자 이상`} value={next}
                onChange={e => setNext(e.target.value)} maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="pw-confirm" className="block text-xs font-bold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>새 비밀번호 확인</label>
              <input id="pw-confirm" type="password" autoComplete="new-password" value={confirm}
                onChange={e => setConfirm(e.target.value)} maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            {error && <p role="alert" className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>}
            <div className="flex items-center justify-between pt-1">
              <Link to="/forgot-password" className="text-xs hover:underline" style={{ color: 'var(--color-on-surface-variant)' }}>
                현재 비밀번호를 모르겠어요
              </Link>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                {submitting ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-outline-strong)' }}>
              변경하면 이 기기를 제외한 다른 기기에서는 로그아웃됩니다.
            </p>
          </form>
        )}
      </section>
    </div>
  )
}
