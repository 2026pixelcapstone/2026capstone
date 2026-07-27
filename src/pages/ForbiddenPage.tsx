import { Link, useNavigate } from 'react-router-dom'

export default function ForbiddenPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6"
      style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="text-center">
        <p className="text-8xl font-bold mb-2" style={{ color: 'var(--color-surface-container)' }}>403</p>
        <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: 'var(--color-outline)' }}>
          lock
        </span>
        <h1 className="text-xl font-bold mb-2">접근 권한이 없습니다</h1>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          이 페이지에 접근할 권한이 없습니다.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-xl font-bold text-sm transition-colors hover:bg-surface-container"
          style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
          이전 페이지
        </button>
        <Link to="/"
          className="px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
          style={{ background: 'var(--color-primary)', color: '#fff' }}>
          메인으로
        </Link>
      </div>
    </div>
  )
}
