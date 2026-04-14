import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function PrivateRoute() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const location = useLocation()

  if (!isLoggedIn) {
    // 로그인 후 원래 페이지로 돌아오도록 state에 저장
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
