import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  userId: number
  email: string
  nickname: string
  role: string
  profileImageUrl?: string;
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isLoggedIn: boolean
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: AuthUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isLoggedIn: false,

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isLoggedIn: true }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, isLoggedIn: false }),
    }),
    {
      name: 'auth-storage',
      // accessToken은 메모리에만 두고 싶을 수 있으나
      // 현재는 페이지 새로고침 유지를 위해 전체 persist
    }
  )
)
