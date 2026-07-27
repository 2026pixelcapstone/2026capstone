import { Link, useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6"
      style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="text-center">
        <p className="text-8xl font-bold mb-2" style={{ color: 'var(--color-surface-container)' }}>404</p>
        <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: 'var(--color-outline)' }}>
          search_off
        </span>
        <h1 className="text-xl font-bold mb-2">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          요청하신 페이지가 존재하지 않거나 삭제되었습니다.
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
