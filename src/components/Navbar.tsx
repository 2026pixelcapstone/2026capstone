import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/authApi'
import FontSelector from './FontSelector'
import NotificationBell from './NotificationBell'
import { toast } from '../store/toastStore'
import { useEmailGate } from '../hooks/useEmailGate'
import { useActiveCommissions, partnerNickname, ACTIVE_STATUS_LABEL } from '../hooks/useActiveCommissions'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isLoggedIn, user, logout } = useAuthStore()
  const { blocked: gateBlocked, message: gateMessage } = useEmailGate()
  const [galleryOpen, setGalleryOpen] = useState(false)

  // E-1 "내 거래" — 진행 중 거래 상시 진입점 (로그인 시)
  const { active } = useActiveCommissions()
  const [dealsOpen, setDealsOpen] = useState(false)
  const dealsRef = useRef<HTMLDivElement>(null)
  // 로그아웃하거나 진행 중 거래가 0이 되면 드롭다운을 닫는다
  // (열린 채로 목록이 사라지면 dealsOpen이 true로 남아, 재로그인 시 자동으로 열리는 것 방지)
  useEffect(() => {
    if (!isLoggedIn || active.length === 0) setDealsOpen(false)
  }, [isLoggedIn, active.length])
  useEffect(() => {
    if (!dealsOpen) return
    const onDown = (e: MouseEvent) => {
      if (dealsRef.current && !dealsRef.current.contains(e.target as Node)) setDealsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [dealsOpen])

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

          {/* E-1: 내 거래 — 진행 중 거래 상시 진입점 (로그인 + 진행 중 있을 때만) */}
          {isLoggedIn && active.length > 0 && (
            <div className="relative" ref={dealsRef}>
              <button
                onClick={() => setDealsOpen(o => !o)}
                aria-haspopup="menu" aria-expanded={dealsOpen}
                className="flex items-center gap-1.5 text-base font-semibold tracking-tight transition-colors"
                style={{ color: dealsOpen ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', borderBottom: '2px solid transparent', paddingBottom: 3 }}>
                내 거래
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                  {active.length}
                </span>
              </button>

              {dealsOpen && (
                <div className="absolute top-full right-0 pt-2 z-50">
                  <div className="rounded-xl border overflow-hidden shadow-xl"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)', width: 300 }}>
                    <div className="px-4 py-2.5 border-b text-xs font-bold uppercase tracking-widest"
                      style={{ borderColor: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                      진행 중인 거래
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {active.map(c => (
                        <button key={c.commissionId} type="button"
                          onClick={() => { setDealsOpen(false); navigate(`/commission/${c.commissionId}`) }}
                          className="w-full text-left px-4 py-3 border-b transition-colors hover:bg-surface-container-low"
                          style={{ borderColor: 'var(--color-surface-container)' }}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{
                                color: c.status === 'REVIEW' ? 'var(--color-secondary)' : 'var(--color-primary)',
                                background: c.status === 'REVIEW'
                                  ? 'color-mix(in srgb, var(--color-secondary) 10%, transparent)'
                                  : 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                              }}>
                              {ACTIVE_STATUS_LABEL[c.status] ?? c.status}
                            </span>
                            {c.unreadCount > 0 && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center"
                                style={{ background: 'var(--color-error)', color: 'var(--color-on-primary)' }}>
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold line-clamp-1" style={{ color: 'var(--color-on-surface)' }}>
                            {c.title ?? '커미션 거래'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {c.role === 'client' ? '작가' : '의뢰자'}: @{partnerNickname(c)}
                          </p>
                        </button>
                      ))}
                    </div>
                    <Link to="/commission?tab=mine" onClick={() => setDealsOpen(false)}
                      className="block px-4 py-2.5 text-center text-xs font-bold transition-colors hover:bg-surface-container-low"
                      style={{ color: 'var(--color-primary)' }}>
                      내 커미션 전체 보기 →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
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
