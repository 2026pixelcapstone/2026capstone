import StarRating from './StarRating'
import type { ArtistRatingSummary } from '../api/commissionApi'

// 리뷰 4개 미만이면 "평가 부족"(에셋 평점 정책과 동일)
const MIN_REVIEWS = 4

/**
 * 작가 신뢰 신호 — 별점+평균+리뷰수(또는 "평가 부족") + 완료 거래 건수.
 * 서비스 카드/상세에서 공용으로 사용. summary가 없으면(로딩 전) 아무것도 안 그림.
 */
export default function ArtistTrustSignal({
  summary,
  size = 14,
  className = '',
}: {
  summary?: ArtistRatingSummary
  size?: number
  className?: string
}) {
  if (!summary) return null
  const { average, reviewCount, completedCount } = summary
  const hasEnough = reviewCount >= MIN_REVIEWS

  return (
    <div className={`flex items-center gap-2 text-xs flex-wrap ${className}`} style={{ color: 'var(--color-on-surface-variant)' }}>
      {hasEnough ? (
        <span className="flex items-center gap-1">
          <StarRating value={average} size={size} />
          <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>{average.toFixed(1)}</span>
          <span>({reviewCount})</span>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <StarRating value={0} size={size} />
          <span>{reviewCount > 0 ? `평가 부족 (${reviewCount})` : '리뷰 없음'}</span>
        </span>
      )}
      {completedCount > 0 && (
        <span className="flex items-center gap-0.5">
          <span aria-hidden="true">·</span>
          <span className="material-symbols-outlined" style={{ fontSize: size }}>task_alt</span>
          완료 {completedCount}건
        </span>
      )}
    </div>
  )
}
