import { Link } from 'react-router-dom'
import type { CommissionSummary, CommissionStatus } from '../api/commissionApi'

// CommissionStatus 전부를 키로 강제 → 매핑 누락을 컴파일 단계에서 잡음
const STATUS_LABEL: Record<CommissionStatus, { label: string; color: string; bg: string }> = {
  IN_PROGRESS: { label: '진행 중', color: '#2f81f7', bg: 'rgba(47,129,247,0.1)' },
  REVIEW:      { label: '검토 중', color: '#f0883e', bg: 'rgba(240,136,62,0.1)' },
  COMPLETED:   { label: '완료',    color: '#3fb950', bg: 'rgba(63,185,80,0.1)' },
  CANCELLED:   { label: '취소됨',  color: '#7d8590', bg: 'rgba(125,133,144,0.1)' },
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
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#21262d' }} />
        ))}
      </div>
    )
  }

  if (commissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="material-symbols-outlined text-4xl" style={{ color: '#30363d' }}>payments</span>
        <p className="text-sm" style={{ color: '#7d8590' }}>
          {perspective === 'client' ? '의뢰한 커미션이 없습니다.' : '받은 커미션이 없습니다.'}
        </p>
        {perspective === 'client' && (
          <Link to="/commission"
            className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
            style={{ background: '#2f81f7', color: '#fff' }}>
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
            className="flex items-center justify-between px-5 py-4 rounded-xl border transition-all hover:border-[#2f81f7] hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: '#21262d', borderColor: '#30363d' }}>
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(47,129,247,0.1)', color: '#2f81f7', border: '1px solid rgba(47,129,247,0.2)' }}>
                    {TYPE_LABEL[c.commissionType] ?? c.commissionType}
                  </span>
                  <span className="text-xs font-bold truncate" style={{ color: '#e6edf3' }}>
                    {otherNickname ?? '—'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: '#7d8590' }}>
                  <span>₩{(c.agreedPrice ?? 0).toLocaleString()}</span>
                  {c.agreedDeadline && <span>마감 {new Date(c.agreedDeadline).toLocaleDateString('ko-KR')}</span>}
                  <span>{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </div>
            <span className="ml-4 shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: s.bg, color: s.color }}>
              {s.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
