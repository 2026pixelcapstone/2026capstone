import { Link, useNavigate } from 'react-router-dom'

export default function ServerErrorPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6"
      style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="text-center">
        <p className="text-8xl font-bold mb-2" style={{ color: '#21262d' }}>500</p>
        <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: '#30363d' }}>
          bug_report
        </span>
        <h1 className="text-xl font-bold mb-2">서버 오류가 발생했습니다</h1>
        <p className="text-sm" style={{ color: '#7d8590' }}>
          일시적인 오류입니다. 잠시 후 다시 시도해주세요.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(0)}
          className="px-5 py-2.5 rounded-xl font-bold text-sm transition-colors hover:bg-[#21262d]"
          style={{ border: '1px solid #30363d', color: '#e6edf3' }}>
          새로고침
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
