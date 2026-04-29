import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import { useAuthStore } from '../store/authStore'
import { useBlockStore } from '../store/blockStore'

export default function MainLayout() {
  const { isLoggedIn } = useAuthStore()
  const { fetchBlocks, clearBlocks, loaded } = useBlockStore()

  // 로그인 상태이고 아직 차단 목록을 불러오지 않았으면 서버에서 로드
  useEffect(() => {
    if (isLoggedIn && !loaded) {
      fetchBlocks()
    }
    if (!isLoggedIn) {
      clearBlocks()
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
