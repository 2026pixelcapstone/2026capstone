import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import { useAuthStore } from '../store/authStore'
import { useBlockStore } from '../store/blockStore'
import { useLikeStore } from '../store/likeStore'

export default function MainLayout() {
  const { isLoggedIn } = useAuthStore()
  const { fetchBlocks, clearBlocks, loaded } = useBlockStore()
  const { clearGalleryLikes } = useLikeStore()

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
        <Outlet />
      </main>
      <Toast />
    </div>
  )
}
