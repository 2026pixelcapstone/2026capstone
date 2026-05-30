import { useAuthStore } from "../store/authStore";
import { Navigate, Outlet } from "react-router-dom";

// 관리자 페이지 입장 시 검증
interface ProtectedRouteProps{
    allowedRoles: string[];
}

const ProtectedRoute = ({ allowedRoles: _allowedRoles }: ProtectedRouteProps) => {
    const {isLoggedIn} = useAuthStore();

    
    // 로그인 상태가 아닐 경우에는 로그인 페이지로
    if(!isLoggedIn){
        return <Navigate to = "/login" replace />;
    }
    // 권한이 없으면 403 페이지로(user가 널인 관계로 임시 주석 처리)
    /*
    if (user && !allowedRoles.includes(user.role)) {
        return <Navigate to="/403" replace />;
    }*/
    return <Outlet />;
}

export default ProtectedRoute;