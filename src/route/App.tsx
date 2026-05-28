import { Routes, Route } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import PrivateRoute from '../components/PrivateRoute'
import MainPage from '../pages/MainPage'
import FreeGalleryPage from '../pages/FreeGalleryPage'
import ExGalleryPage from '../pages/ExGalleryPage'
import GalleryDetailPage from '../pages/GalleryDetailPage'
import AssetStorePage from '../pages/AssetStorePage'
import AssetDetailPage from '../pages/AssetDetailPage'
import AssetCreatePage from '../pages/AssetCreatePage'
import AssetUpdatePage from '../pages/AssetUpdatePage'
import EditorPage from '../pages/EditorPage'
import CommissionPage from '../pages/CommissionPage'
import CommissionDetailPage from '../pages/CommissionDetailPage'
import RequestPostDetailPage from '../pages/RequestPostDetailPage'
import ArtistServiceDetailPage from '../pages/ArtistServiceDetailPage'
import LoginPage from '../pages/LoginPage'
import SignupPage from '../pages/SignupPage'
import MyPage from '../pages/MyPage'
import ProfilePage from '../pages/ProfilePage'
import NotFoundPage from '../pages/NotFoundPage'
import ForbiddenPage from '../pages/ForbiddenPage'
import ServerErrorPage from '../pages/ServerErrorPage'

// 관리자
import ProtectedRoute from '../route/ProtectRoute'
import AdminLayout from '../admin/layouts/AdminLayout'
import AdminDashboardPage from '../admin/page/DashboardPage'
import UserManagementPage from '../admin/page/UserManagementPage'
import ReportManagementPage from '../admin/page/ReportManagementPage'
import ContentManagementPage from '../admin/page/ContentManagementPage'
import PaletteManagementPage from '../admin/page/PaletteManagementPage'
import TeamMemberPage from '../admin/page/TeamMemberPage'
import CommissionManagementPage from '../admin/page/CommissionManagementPage'
import SettlementManagementPage from '../admin/page/SettlementManagementPage'
import AdminAuditLogPage from '../admin/page/AdminAuditLogPage'
import EditorTechSettingPage from '../admin/page/EditorTechSettingPage'
import SystemNotificationPage from '../admin/page/SystemNotificationPage'

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
          <Route path="/assets/create" element={<AssetCreatePage />} />
          <Route path="/assets/:id/edit" element={<AssetUpdatePage />} />
        </Route>
      </Route>

      {/* 관리자 전용 페이지 그룹(임시로 권한 미검증 하게 함) */}
      <Route element = {<ProtectedRoute allowedRoles={['ROLE_ADMIN']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path='/admin/users' element={<UserManagementPage />} />
          <Route path='/admin/reports' element={<ReportManagementPage />} />
          <Route path='/admin/contents' element={<ContentManagementPage />} />
          <Route path='/admin/palettes' element={<PaletteManagementPage />} />
          <Route path='/admin/collaboration' element={<TeamMemberPage />} />
          <Route path='/admin/commissions' element={<CommissionManagementPage />} />
          <Route path='/admin/commerce' element={<SettlementManagementPage />} />
          <Route path='/admin/audit-logs' element={<AdminAuditLogPage />} />
          <Route path='/admin/tech-settings' element={<EditorTechSettingPage />} />
          <Route path='/admin/system' element={<SystemNotificationPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
