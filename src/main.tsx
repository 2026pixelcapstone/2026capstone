import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './route/App'
import { restoreFonts } from './store/fontStore'

// 저장된 폰트 설정 복원 (렌더링 전 적용)
restoreFonts()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
