import { Link } from 'react-router-dom'
import type { CommissionSummary, CommissionStatus } from '../api/commissionApi'

// CommissionStatus 전부를 키로 강제 → 매핑 누락을 컴파일 단계에서 잡음
const STATUS_LABEL: Record<CommissionStatus, { label: string; color: string; bg: string }> = {
  PENDING_PAYMENT: { label: '결제 대기', color: 'var(--color-warning)', bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)' },
  IN_PROGRESS: { label: '진행 중', color: 'var(--color-primary)', bg: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' },
  REVIEW:      { label: '검토 중', color: 'var(--color-accent)', bg: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' },
  COMPLETED:   { label: '완료',    color: 'var(--color-success)', bg: 'color-mix(in srgb, var(--color-success) 10%, transparent)' },
  CANCELLED:   { label: '취소됨',  color: 'var(--color-on-surface-variant)', bg: 'color-mix(in srgb, var(--color-on-surface-variant) 10%, transparent)' },
}

const TYPE_LABEL: Record<string, string> = {
  SERVICE_OPTION: '작가 서비스',
  SERVICE_QUOTE:  '작가 서비스',
  REQUEST:        '의뢰 게시판',
}

interface CommissionListProps {
  commissions: CommissionSummary[]
  loading: boolean
  /** 'client' = 의뢰한 커미션(상대=작가), 'artist' = 받은 커미션(상대=의뢰자) */
  perspective: 'client' | 'artist'
}

/**
 * 계약(커미션) 목록 — MyPage / CommissionPage "내 커미션" 탭 공용.
 * 카드는 거래룸(/commission/:id)으로 이동.
 */
export default function CommissionList({ commissions, loading, perspective }: CommissionListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
        ))}
      </div>
    )
  }

  if (commissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>payments</span>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {perspective === 'client' ? '의뢰한 커미션이 없습니다.' : '받은 커미션이 없습니다.'}
        </p>
        {perspective === 'client' && (
          <Link to="/commission"
            className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
            style={{ background: 'var(--color-primary)', color: '#fff' }}>
            커미션 찾기
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {commissions.map(c => {
        const s = STATUS_LABEL[c.status]
        const otherNickname = perspective === 'client' ? c.artistNickname : c.clientNickname
        return (
          <Link key={c.commissionId} to={`/commission/${c.commissionId}`}
            className="flex items-center justify-between px-5 py-4 rounded-xl border transition-all hover:border-primary hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
                    {TYPE_LABEL[c.commissionType] ?? c.commissionType}
                  </span>
                  <span className="text-xs truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {otherNickname ?? '—'}
                  </span>
                </div>
                {/* 거래 스냅샷 제목 — 무슨 작업이었는지. 옛 거래(스냅샷 이전)는 null */}
                <div className="text-sm font-bold truncate" style={{ color: 'var(--color-on-surface)' }}>
                  {c.title ?? '(제목 없음)'}
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span>₩{(c.agreedPrice ?? 0).toLocaleString()}</span>
                  {c.agreedDeadline && <span>마감 {new Date(c.agreedDeadline).toLocaleDateString('ko-KR')}</span>}
                  <span>{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </div>
            <div className="ml-4 shrink-0 flex items-center gap-2">
              {c.unreadCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--color-error)', color: '#fff' }}
                  title={`안 읽은 메시지 ${c.unreadCount}개`}
                  aria-label={`안 읽은 메시지 ${c.unreadCount}개`}>
                  {c.unreadCount > 99 ? '99+' : c.unreadCount}
                </span>
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: s.bg, color: s.color }}>
                {s.label}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
