import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import EmailVerificationBanner from '../components/EmailVerificationBanner'
import { useAuthStore } from '../store/authStore'
import { useBlockStore } from '../store/blockStore'
import { useLikeStore } from '../store/likeStore'
import { userApi } from '../api/userApi'

export default function MainLayout() {
  const { isLoggedIn, user, setUser } = useAuthStore()
  const { fetchBlocks, clearBlocks, loaded } = useBlockStore()
  const { clearGalleryLikes } = useLikeStore()

  // 로그인 상태인데 user 정보가 없거나(새로고침/첫 로그인) emailVerified 정보가 없으면
  // (이 기능 이전에 로그인해 둔 레거시 세션) 서버에서 복구
  useEffect(() => {
    if (isLoggedIn && (!user || user.emailVerified === undefined)) {
      userApi.getMe()
        .then(res => {
          const { userId, email, nickname, role, profileImageUrl, emailVerified } = res.data.data
          setUser({ userId, email, nickname, role, profileImageUrl: profileImageUrl ?? undefined, emailVerified })
        })
        .catch(() => {/* 토큰 만료 등 — 인터셉터가 처리 */})
    }
  }, [isLoggedIn, user])

  // 로그인 상태이고 아직 차단 목록을 불러오지 않았으면 서버에서 로드
  useEffect(() => {
    if (isLoggedIn && !loaded) {
      fetchBlocks()
    }
    if (!isLoggedIn) {
      clearBlocks()
      clearGalleryLikes()   // 다른 사용자 좋아요 캐시 오염 방지
    }
  }, [isLoggedIn])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Navbar />
      <main className="pt-20">
        <EmailVerificationBanner />
        <Outlet />
      </main>
      <Toast />
    </div>
  )
}
