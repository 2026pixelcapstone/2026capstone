import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { userApi } from '../../api/userApi'
import { useAuthStore } from '../../store/authStore'
import { useActiveCommissionStore, partnerNickname } from '../../store/activeCommissionStore'
import { getErrorCode, getErrorMessage } from '../../lib/errorUtils'
import { setFlashToast } from '../../lib/flashToast'

interface WithdrawalSectionProps {
  /** 비밀번호 계정이면 비밀번호로, 소셜 전용이면 닉네임 입력으로 본인 확인. 아직 모르면 null/undefined */
  hasPassword: boolean | null | undefined
  nickname: string | undefined
}

const GONE = ['프로필(닉네임·소개·사진)과 로그인 정보', '좋아요·팔로우·차단 목록·알림', '작품은 비공개, 팔레트는 숨김, 저장된 프로젝트 삭제',
  '판매 중인 에셋은 판매 중지(이미 산 사람은 계속 받을 수 있어요)', '열려 있는 작가 서비스·의뢰글 마감, 대기 중인 지원 취소']
const KEPT = ['끝난 거래·결제·구매 기록과 채팅, 리뷰', '남긴 댓글 — 작성자가 \'탈퇴한 사용자\'로 보여요']

/**
 * 계정 설정 탭의 회원 탈퇴. 진행 중인 거래가 있으면 버튼을 막고 목록을 보여 줌(서버도 409로 막음).
 * 성공하면 서버가 토큰을 모두 무효로 하므로 곧바로 로그아웃.
 */
export default function WithdrawalSection({ hasPassword, nickname }: WithdrawalSectionProps) {
  const { active, loading: activeLoading, fetch: fetchActive } = useActiveCommissionStore()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmNickname, setConfirmNickname] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 펼칠 때 진행 중 거래를 새로 확인(다른 화면에서 받은 목록이 오래됐을 수 있음)
  useEffect(() => {
    if (open) fetchActive()
  }, [open, fetchActive])

  const hasActive = active.length > 0
  const identityFilled = hasPassword ? password.length > 0 : confirmNickname.length > 0
  const canSubmit = !submitting && !activeLoading && !hasActive && agreed && identityFilled && hasPassword != null

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    if (!confirm('정말 탈퇴할까요? 되돌릴 수 없습니다.')) return
    setSubmitting(true)
    setError('')
    try {
      await userApi.withdraw(hasPassword ? { password } : { confirmNickname })
      // 전체 새로고침으로 메인 이동 — 라우터 이동은 전환(transition)으로 늦게 반영돼, 로그아웃이 먼저 그려지면
      // 마이페이지(로그인 필수)가 /login으로 보내 버림. 새로고침은 메모리에 남은 사용자별 상태도 함께 비움
      setFlashToast('탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.')
      useAuthStore.getState().logout()
      window.location.replace('/')
      return
    } catch (err) {
      setError(getErrorMessage(err, '탈퇴에 실패했습니다.'))
      // 그 사이 거래가 생겼으면 목록을 다시 받아 보여 줌
      if (getErrorCode(err) === 'WITHDRAWAL_ACTIVE_COMMISSION') fetchActive()
    } finally {
      setSubmitting(false)
    }
  }

  const muted = { color: 'var(--color-on-surface-variant)' }
  const inputStyle = { background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }

  return (
    <section className="rounded-xl border p-5"
      style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">회원 탈퇴</h3>
        {!open && (
          <button type="button" onClick={() => setOpen(true)}
            className="text-xs font-bold hover:underline" style={{ color: 'var(--color-error)' }}>
            탈퇴 안내 보기
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleWithdraw} className="mt-4 space-y-4 text-sm">
          <div>
            <p className="font-bold text-xs mb-1.5">사라지는 것</p>
            <ul className="list-disc pl-5 space-y-0.5 text-xs" style={muted}>{GONE.map(t => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <p className="font-bold text-xs mb-1.5">남는 것</p>
            <ul className="list-disc pl-5 space-y-0.5 text-xs" style={muted}>{KEPT.map(t => <li key={t}>{t}</li>)}</ul>
          </div>
          <p className="text-xs" style={muted}>탈퇴 후 같은 이메일로 다시 가입할 수 있지만, 이전 계정의 기록은 되살릴 수 없어요.</p>

          {/* 진행 중 거래 — 있으면 탈퇴 불가 */}
          {activeLoading && !hasActive ? (
            <div className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--color-surface-container-high)' }} />
          ) : hasActive && (
            <div className="rounded-lg p-3 space-y-2"
              style={{ background: 'color-mix(in srgb, var(--color-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--color-error)' }}>
                진행 중인 거래 {active.length}건이 있어 지금은 탈퇴할 수 없어요. 완료하거나 취소한 뒤 다시 시도해 주세요.
              </p>
              <ul className="space-y-1">
                {active.map(c => (
                  <li key={c.commissionId}>
                    <Link to={`/commission/${c.commissionId}`} className="text-xs hover:underline" style={{ color: 'var(--color-on-surface)' }}>
                      {c.title ?? `계약 #${c.commissionId}`} · {partnerNickname(c)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 본인 확인 */}
          {hasPassword ? (
            <div>
              <label htmlFor="withdraw-password" className="block text-xs font-bold mb-1" style={muted}>비밀번호 확인</label>
              <input id="withdraw-password" type="password" autoComplete="current-password" value={password}
                onChange={e => setPassword(e.target.value)} maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
          ) : hasPassword === false && (
            <div>
              <label htmlFor="withdraw-nickname" className="block text-xs font-bold mb-1" style={muted}>
                확인을 위해 닉네임 <span className="font-mono" style={{ color: 'var(--color-on-surface)' }}>{nickname}</span>을(를) 그대로 입력해 주세요
              </label>
              <input id="withdraw-nickname" type="text" value={confirmNickname}
                onChange={e => setConfirmNickname(e.target.value)} maxLength={50}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
            위 내용을 확인했고, 탈퇴하면 되돌릴 수 없다는 것에 동의합니다.
          </label>

          {error && <p role="alert" className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setError('') }}
              className="px-4 py-2 rounded-lg font-bold text-sm hover:bg-surface-container-high"
              style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
              닫기
            </button>
            <button type="submit" disabled={!canSubmit}
              className="px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--color-error)', color: '#fff' }}>
              {submitting ? '탈퇴 중...' : '탈퇴하기'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
