import { Link } from 'react-router-dom'
import type { SalesSummary } from '../../api/userApi'
import { RailCard } from './MainShared'

const won = (n: number) => `₩${n.toLocaleString()}`

/** 메인 페이지가 받아 내려 주는 상태 — null이면 받는 중 */
export interface SalesReportState {
  data: SalesSummary | null
  failed: boolean
}

/**
 * 메인 왼쪽 레일 '내 판매 리포트' — 에셋 판매·무료 취득·커미션 수익 미니 보고서.
 * 데이터는 MainPage가 사용자 기준으로 한 번 받는다(레일이 화면 폭별로 두 번 그려져도 요청은 1번).
 * 실패해도 메인 전체를 막지 않고 이 카드만 안내.
 */
export default function MySalesReport({ state, onRetry }: { state: SalesReportState | null; onRetry: () => void }) {
  const muted = { color: 'var(--color-on-surface-variant)' }

  return (
    <RailCard title="내 판매 리포트" icon="monitoring" to="/mypage?tab=assets" linkLabel="내 에셋">
      {!state ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-4 rounded" style={{ background: 'var(--color-surface-container-high)' }} />)}
        </div>
      ) : state.failed || !state.data ? (
        <div className="text-xs flex items-center justify-between gap-2" role="alert" style={muted}>
          판매 정보를 불러오지 못했어요.
          <button type="button" onClick={onRetry} className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
            다시 시도
          </button>
        </div>
      ) : (
        <Report data={state.data} />
      )}
    </RailCard>
  )
}

function Report({ data }: { data: SalesSummary }) {
  const muted = { color: 'var(--color-on-surface-variant)' }
  const { assetSales, freeAcquisitions, commissions, topAsset } = data
  const nothingYet = assetSales.count === 0 && freeAcquisitions === 0
    && commissions.completedCount === 0 && commissions.activeCount === 0

  if (nothingYet) {
    return (
      <p className="text-xs leading-relaxed" style={muted}>
        아직 판매 기록이 없어요.{' '}
        <Link to="/assets/create" className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>에셋을 등록</Link>
        하거나 커미션 서비스를 열어 보세요.
      </p>
    )
  }

  return (
    <dl className="space-y-2.5 text-xs">
      <Row label="에셋 판매" value={`${assetSales.count.toLocaleString()}건 · ${won(assetSales.revenue)}`}
        sub={`최근 ${assetSales.recentDays}일 ${assetSales.recentCount.toLocaleString()}건 · ${won(assetSales.recentRevenue)}`} />
      <Row label="무료 에셋 받은 사람" value={`${freeAcquisitions.toLocaleString()}명`} />
      <Row label="커미션 수익" value={`${commissions.completedCount.toLocaleString()}건 · ${won(commissions.earned)}`}
        sub={commissions.activeCount > 0 ? `진행 중 ${commissions.activeCount.toLocaleString()}건` : undefined} />
      {topAsset && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--color-outline)' }}>
          <dt style={muted}>가장 많이 팔린 에셋</dt>
          <dd className="mt-0.5">
            <Link to={`/assets/${topAsset.assetId}`} className="font-bold hover:underline truncate block" title={topAsset.title}>
              {topAsset.title}
            </Link>
            <span style={muted}>{topAsset.sales.toLocaleString()}건 판매</span>
          </dd>
        </div>
      )}
    </dl>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <dt style={{ color: 'var(--color-on-surface-variant)' }}>{label}</dt>
        <dd className="font-bold tabular-nums">{value}</dd>
      </div>
      {sub && <div className="text-[11px] text-right tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{sub}</div>}
    </div>
  )
}
