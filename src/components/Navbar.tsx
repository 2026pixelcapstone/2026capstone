import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/authApi'
import FontSelector from './FontSelector'
import NotificationBell from './NotificationBell'
import { toast } from '../store/toastStore'
import { useEmailGate } from '../hooks/useEmailGate'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isLoggedIn, user, logout } = useAuthStore()
  const { blocked: gateBlocked, message: gateMessage } = useEmailGate()
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
      style={{ background: 'color-mix(in srgb, var(--color-surface) 95%, transparent)', backdropFilter: 'blur(20px)', borderColor: 'var(--color-surface-container)' }}>
      <div className="flex justify-between items-center h-20 px-8 max-w-[1440px] mx-auto">

        {/* 로고 */}
        <Link to="/" className="text-3xl font-bold tracking-tighter hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-primary)', fontFamily: 'Galmuri11' }}>
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
                color: isGalleryActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                borderBottom: isGalleryActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                paddingBottom: 3,
              }}>
              갤러리
              <span className="material-symbols-outlined text-sm" style={{ fontSize: 16 }}>
                {galleryOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {galleryOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2">
                <div className="rounded-xl border overflow-hidden shadow-xl"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)', minWidth: 160 }}>
                  <Link to="/gallery/free"
                    onClick={() => setGalleryOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-container-low"
                    style={{ color: location.pathname === '/gallery/free' ? 'var(--color-primary)' : 'var(--color-on-surface)' }}>
                    <span className="material-symbols-outlined text-base"
                      style={{ color: location.pathname === '/gallery/free' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
                      photo_library
                    </span>
                    자유 갤러리
                  </Link>
                  <div className="h-px mx-3" style={{ background: 'var(--color-surface-container-highest)' }} />
                  <Link to="/gallery/exclusive"
                    onClick={() => setGalleryOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-container-low"
                    style={{ color: location.pathname === '/gallery/exclusive' ? 'var(--color-primary)' : 'var(--color-on-surface)' }}>
                    <span className="material-symbols-outlined text-base"
                      style={{ color: location.pathname === '/gallery/exclusive' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
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
            { label: '에셋 스토어', to: '/assets' },
            { label: '에디터',     to: '/editor' },
            { label: '커미션',     to: '/commission' },
          ].map(link => {
            const active = location.pathname.startsWith(link.to)
            // 에디터는 콘텐츠 생성(저장)이 미인증 차단 대상 → 진입 자체를 비활성 + 호버 안내
            if (link.to === '/editor' && gateBlocked) {
              return (
                <button key={link.to} type="button" aria-disabled="true" title={gateMessage}
                  onClick={() => toast.error(gateMessage)}
                  className="flex items-center gap-1 p-0 bg-transparent text-base font-semibold tracking-tight cursor-not-allowed select-none"
                  style={{ color: 'var(--color-outline-strong)', borderBottom: '2px solid transparent', paddingBottom: 3 }}>
                  <span className="material-symbols-outlined text-base">lock</span>
                  {link.label}
                </button>
              )
            }
            return (
              <Link key={link.to} to={link.to}
                className="text-base font-semibold tracking-tight transition-colors"
                style={{
                  color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                  borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
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
              placeholder="작품 검색..."
              style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}
            />
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-xl"
              style={{ color: 'var(--color-on-surface-variant)' }}>search</span>
          </div>

          {isLoggedIn ? (
            <div className="flex items-center space-x-1">
              <NotificationBell />
              <Link to="/mypage"
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-surface-container-low"
                style={{ color: 'var(--color-on-surface)' }}>
                <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--color-on-surface-variant)' }}>
                  account_circle
                </span>
                {user?.nickname && (
                  <span className="text-sm font-bold hidden xl:inline">{user.nickname}</span>
                )}
              </Link>
              <button onClick={handleLogout}
                className="p-2.5 rounded-lg transition-all hover:bg-surface-container-low"
                style={{ color: 'var(--color-on-surface-variant)' }}
                title="로그아웃">
                <span className="material-symbols-outlined text-2xl">logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login"
                className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-surface-container-low"
                style={{ color: 'var(--color-on-surface-variant)' }}>
                로그인
              </Link>
              <Link to="/signup"
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: 'var(--color-primary)', color: '#fff' }}>
                회원가입
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
