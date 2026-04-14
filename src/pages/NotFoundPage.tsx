import { Link, useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6"
      style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="text-center">
        <p className="text-8xl font-bold mb-2" style={{ color: '#21262d' }}>404</p>
        <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: '#30363d' }}>
          search_off
        </span>
        <h1 className="text-xl font-bold mb-2">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm" style={{ color: '#7d8590' }}>
          요청하신 페이지가 존재하지 않거나 삭제되었습니다.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-xl font-bold text-sm transition-colors hover:bg-[#21262d]"
          style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
          이전 페이지
        </button>
        <Link to="/"
          className="px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
          style={{ background: '#2f81f7', color: '#fff' }}>
          메인으로
        </Link>
      </div>
    </div>
  )
}
