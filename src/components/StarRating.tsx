/**
 * 별점 표시/입력 공용 컴포넌트.
 * - 표시(interactive=false): value(0~5, 평균은 소수 가능)만큼 채워 보여줌(반올림). 장식용 span.
 * - 입력(interactive=true): 각 별을 네이티브 button으로 렌더 → 포커스/키보드(Enter·Space) 기본 지원.
 */
export default function StarRating({
  value,
  size = 16,
  interactive = false,
  onChange,
}: {
  value: number
  size?: number
  interactive?: boolean
  onChange?: (v: number) => void
}) {
  const filled = Math.round(value)

  const star = (i: number) => (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        color: i <= filled ? 'var(--color-accent)' : 'var(--color-surface-container-highest)',
        fontVariationSettings: i <= filled ? "'FILL' 1" : "'FILL' 0",
        transition: 'color 0.1s',
      }}>
      star
    </span>
  )

  return (
    <span
      className="inline-flex items-center select-none"
      style={{ gap: 1 }}
      aria-label={!interactive ? `별점 ${value}점` : undefined}
      role={!interactive ? 'img' : undefined}>
      {[1, 2, 3, 4, 5].map(i =>
        interactive ? (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(i)}
            aria-label={`${i}점`}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1 }}>
            {star(i)}
          </button>
        ) : (
          <span key={i} aria-hidden="true">{star(i)}</span>
        ),
      )}
    </span>
  )
}
