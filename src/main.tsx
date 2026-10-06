import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './route/App'
import { restoreFonts } from './store/fontStore'
import { bootstrapAuth } from './lib/authBootstrap'

// 저장된 폰트 설정 복원 (렌더링 전 적용)
restoreFonts()

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

// 세션 검증(만료 토큰 선제 재발급/로그아웃)을 끝낸 뒤 렌더 — stale 로그인 상태 방지.
// 성공/실패 무관하게 반드시 렌더한다.
bootstrapAuth().finally(renderApp)
