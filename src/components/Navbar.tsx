import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/authApi'
import FontSelector from './FontSelector'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isLoggedIn, user, logout } = useAuthStore()
  const [galleryOpen, setGalleryOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // 실패해도 클라이언트 로그아웃은 진행
    } finally {
      logout()
      navigate('/')
    }
  }

  const isGalleryActive = location.pathname.startsWith('/gallery')

  return (
    <nav className="fixed top-0 w-full z-50 border-b"
      style={{ background: 'rgba(22,27,34,0.95)', backdropFilter: 'blur(20px)', borderColor: '#21262d' }}>
      <div className="flex justify-between items-center h-20 px-8 max-w-[1440px] mx-auto">

        {/* 로고 */}
        <Link to="/" className="text-3xl font-bold tracking-tighter hover:opacity-80 transition-opacity"
          style={{ color: '#2f81f7', fontFamily: 'Galmuri11' }}>
          PixelHub
        </Link>

        {/* 네비게이션 링크 */}
        <div className="hidden md:flex items-center space-x-10">

          {/* Gallery — 드롭다운 */}
          <div className="relative"
            onMouseEnter={() => setGalleryOpen(true)}
            onMouseLeave={() => setGalleryOpen(false)}>
            <button
              className="flex items-center gap-1 text-base font-semibold tracking-tight transition-colors"
              style={{
                color: isGalleryActive ? '#2f81f7' : '#7d8590',
                borderBottom: isGalleryActive ? '2px solid #2f81f7' : '2px solid transparent',
                paddingBottom: 3,
              }}>
              Gallery
              <span className="material-symbols-outlined text-sm" style={{ fontSize: 16 }}>
                {galleryOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {galleryOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2">
                <div className="rounded-xl border overflow-hidden shadow-xl"
                  style={{ background: '#161b22', borderColor: '#30363d', minWidth: 160 }}>
                  <Link to="/gallery/free"
                    onClick={() => setGalleryOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-[#1c2128]"
                    style={{ color: location.pathname === '/gallery/free' ? '#2f81f7' : '#e6edf3' }}>
                    <span className="material-symbols-outlined text-base"
                      style={{ color: location.pathname === '/gallery/free' ? '#2f81f7' : '#7d8590' }}>
                      photo_library
                    </span>
                    자유 갤러리
                  </Link>
                  <div className="h-px mx-3" style={{ background: '#30363d' }} />
                  <Link to="/gallery/exclusive"
                    onClick={() => setGalleryOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-[#1c2128]"
                    style={{ color: location.pathname === '/gallery/exclusive' ? '#2f81f7' : '#e6edf3' }}>
                    <span className="material-symbols-outlined text-base"
                      style={{ color: location.pathname === '/gallery/exclusive' ? '#2f81f7' : '#7d8590' }}>
                      grid_view
                    </span>
                    전용 갤러리
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 나머지 링크 */}
          {[
            { label: 'Store',      to: '/assets' },
            { label: 'Editor',     to: '/editor' },
            { label: 'Commission', to: '/commission' },
          ].map(link => {
            const active = location.pathname.startsWith(link.to)
            return (
              <Link key={link.to} to={link.to}
                className="text-base font-semibold tracking-tight transition-colors"
                style={{
                  color: active ? '#2f81f7' : '#7d8590',
                  borderBottom: active ? '2px solid #2f81f7' : '2px solid transparent',
                  paddingBottom: 3,
                }}>
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* 우측 영역 */}
        <div className="flex items-center space-x-4">
          <FontSelector />

          {/* 검색창 */}
          <div className="relative hidden lg:block">
            <input
              className="rounded-full py-2.5 pl-11 pr-5 w-72 text-sm outline-none"
              placeholder="Search curated art..."
              style={{ background: '#21262d', color: '#e6edf3' }}
            />
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-xl"
              style={{ color: '#7d8590' }}>search</span>
          </div>

          {isLoggedIn ? (
            <div className="flex items-center space-x-1">
              <button className="p-2.5 rounded-lg transition-all hover:bg-[#1c2128]"
                style={{ color: '#7d8590' }}>
                <span className="material-symbols-outlined text-2xl">notifications</span>
              </button>
              <Link to="/mypage"
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-[#1c2128]"
                style={{ color: '#e6edf3' }}>
                <span className="material-symbols-outlined text-2xl" style={{ color: '#7d8590' }}>
                  account_circle
                </span>
                {user?.nickname && (
                  <span className="text-sm font-bold hidden xl:inline">{user.nickname}</span>
                )}
              </Link>
              <button onClick={handleLogout}
                className="p-2.5 rounded-lg transition-all hover:bg-[#1c2128]"
                style={{ color: '#7d8590' }}
                title="로그아웃">
                <span className="material-symbols-outlined text-2xl">logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login"
                className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[#1c2128]"
                style={{ color: '#7d8590' }}>
                로그인
              </Link>
              <Link to="/signup"
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: '#2f81f7', color: '#fff' }}>
                회원가입
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
