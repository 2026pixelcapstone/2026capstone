import { Outlet, Link, useNavigate } from "react-router-dom";

import { useAuthStore } from "../../store/authStore"

const AdminLayout = () => {
    const { user, logout, isLoggedIn } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="flex min-h-screen bg-gray-100 text-lg">
            {/* 사이드바 - w-72 */}
            <aside className="w-72 bg-slate-900 text-white p-8 shadow-2xl flex flex-col sticky top-0 h-screen">
                <h2 className="text-3xl font-black mb-12 text-blue-400 tracking-tight">
                    PixelHub
                </h2>
                
                <nav className="flex-1 space-y-6 overflow-y-auto">
                    <Link to="/admin" className="block font-semibold hover:text-blue-300 transition-colors">📊 종합 대시보드</Link>
                    <Link to="/admin/users" className="block hover:text-blue-300 transition-colors">👤 사용자 및 권한 관리</Link>
                    <Link to="/admin/reports" className="block hover:text-blue-300 transition-colors">🚨 신고 & 제재 센터</Link>
                    <Link to="/admin/contents" className="block hover:text-blue-300 transition-colors">🖼️ 콘텐츠 관리</Link>
                    <Link to="/admin/palettes" className="block hover:text-blue-300 transition-colors">🎨 팔레트 관리</Link>
                    <Link to="/admin/collaboration" className="block hover:text-blue-300 transition-colors">🤝 협업 및 팀 관리</Link>
                    <Link to="/admin/commissions" className="block hover:text-blue-300 transition-colors">💼 커미션 진행 및 관리</Link>
                    <Link to="/admin/commerce" className="block hover:text-blue-300 transition-colors">💰 커머스 및 정산 관리</Link>
                    <Link to="/admin/audit-logs" className="block hover:text-blue-300 transition-colors">📜 관리자 활동 로그</Link>
                    <Link to="/admin/tech-settings" className="block hover:text-blue-300 transition-colors">⚙️ 에디터 및 기술 관리</Link>
                    <Link to="/admin/system" className="block hover:text-blue-300 transition-colors">🌐 시스템 및 알림 관리</Link>
                </nav>

                <div className="mt-auto pt-10">
                    <hr className="border-slate-700 mb-6" />
                    <Link to="/" className="block text-gray-400 hover:text-white font-medium text-base">
                        ← 메인으로 돌아가기
                    </Link>
                </div>
            </aside>

            {/* 메인 콘텐츠 영역 */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* 상단 헤더 - 프로필 & 로그아웃 섹션 */}
                <header className="h-24 bg-white border-b-2 border-gray-200 px-12 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900">관리 시스템</h1>
                        <p className="text-gray-500 text-sm font-medium">관리자 전용 제어 센터</p>
                    </div>

                    <div className="flex items-center gap-8">
                        {/* 상태 표시줄 */}
                        <div className="hidden md:flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-bold border border-green-200">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            서버 상태 정상
                        </div>

                        {/* 프로필 섹션 */}
                        <div className="flex items-center gap-4 pl-8 border-l-2 border-gray-100">
                            <div className="text-right">
                                <p className="text-base font-bold text-gray-900">
                                    {user?.nickname || "관리자 미식별"}
                                </p>
                                <p className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-center">
                                    {user?.role || "UNKNOWN_ROLE"}
                                </p>
                            </div>
                            
                            {/* 아바타 이미지 (없을 경우 기본 아이콘), 디자인 작업 중이니 user as any로 잠시 우회함 */}
                            <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                                {user?.profileImageUrl ? (
                                    
                                    <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" /> 
                                ) : (
                                    <span className="text-2xl text-gray-400 opacity-80">👤</span>
                                )}
                            </div>

                            {/* 로그아웃 버튼 */}
                            <button 
                                onClick={handleLogout}
                                className="ml-2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="로그아웃"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>
                
                {/* 본문 콘텐츠 영역 */}
                <div className="p-12 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-10 min-h-[calc(100vh-14rem)] border border-gray-100">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};
export default AdminLayout;