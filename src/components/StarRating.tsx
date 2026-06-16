/**
 * 별점 표시/입력 공용 컴포넌트.
 * - 표시(interactive=false): value(0~5, 평균은 소수 가능)만큼 채워 보여줌(반올림).
 * - 입력(interactive=true): 클릭 시 onChange(1~5) 호출.
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
  return (
    <span className="inline-flex items-center" style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          onClick={interactive ? () => onChange?.(i) : undefined}
          role={interactive ? 'button' : undefined}
          aria-label={interactive ? `${i}점` : undefined}
          className="material-symbols-outlined select-none"
          style={{
            fontSize: size,
            lineHeight: 1,
            color: i <= filled ? '#f0883e' : '#30363d',
            cursor: interactive ? 'pointer' : 'default',
            fontVariationSettings: i <= filled ? "'FILL' 1" : "'FILL' 0",
            transition: 'color 0.1s',
          }}>
          star
        </span>
      ))}
    </span>
  )
}
