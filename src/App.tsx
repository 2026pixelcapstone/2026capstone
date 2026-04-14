import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import PrivateRoute from './components/PrivateRoute'
import MainPage from './pages/MainPage'
import FreeGalleryPage from './pages/FreeGalleryPage'
import ExGalleryPage from './pages/ExGalleryPage'
import GalleryDetailPage from './pages/GalleryDetailPage'
import AssetStorePage from './pages/AssetStorePage'
import AssetDetailPage from './pages/AssetDetailPage'
import EditorPage from './pages/EditorPage'
import CommissionPage from './pages/CommissionPage'
import CommissionDetailPage from './pages/CommissionDetailPage'
import RequestPostDetailPage from './pages/RequestPostDetailPage'
import ArtistServiceDetailPage from './pages/ArtistServiceDetailPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MyPage from './pages/MyPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'
import ForbiddenPage from './pages/ForbiddenPage'
import ServerErrorPage from './pages/ServerErrorPage'

export default function App() {
  return (
    <Routes>
      {/* 인증 페이지 — 레이아웃 없음 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* 에러 페이지 — 레이아웃 없음 */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/500" element={<ServerErrorPage />} />

      {/* 일반 공개 페이지 */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<MainPage />} />
        <Route path="/gallery/free" element={<FreeGalleryPage />} />
        <Route path="/gallery/exclusive" element={<ExGalleryPage />} />
        <Route path="/gallery/:id" element={<GalleryDetailPage />} />
        <Route path="/assets" element={<AssetStorePage />} />
        <Route path="/assets/:id" element={<AssetDetailPage />} />
        <Route path="/commission" element={<CommissionPage />} />
        <Route path="/commission/:id" element={<CommissionDetailPage />} />
        <Route path="/request-posts/:id" element={<RequestPostDetailPage />} />
        <Route path="/artist-services/:id" element={<ArtistServiceDetailPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        {/* 404 — MainLayout 내부 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* 로그인 필수 페이지 */}
      <Route element={<MainLayout />}>
        <Route element={<PrivateRoute />}>
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/mypage" element={<MyPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
