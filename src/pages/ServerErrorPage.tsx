import { Link, useNavigate } from 'react-router-dom'

export default function ServerErrorPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6"
      style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="text-center">
        <p className="text-8xl font-bold mb-2" style={{ color: 'var(--color-surface-container)' }}>500</p>
        <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: 'var(--color-outline)' }}>
          bug_report
        </span>
        <h1 className="text-xl font-bold mb-2">서버 오류가 발생했습니다</h1>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          일시적인 오류입니다. 잠시 후 다시 시도해주세요.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(0)}
          className="px-5 py-2.5 rounded-xl font-bold text-sm transition-colors hover:bg-surface-container"
          style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
          새로고침
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
