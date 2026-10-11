import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  // 대형 라이브러리 쪼개기 최적화 설정
  build: {
    // 빌드 결과물(JS·CSS) 폴더 — 기본값 'assets'는 에셋 스토어 주소(/assets)와 이름이 겹쳐,
    // 새로고침 시 nginx가 실제 폴더로 보고 301→/assets/→403(폴더 목록 금지)을 냄. 다른 이름으로 분리.
    assetsDir: 'static',
    rollupOptions: {
      output: {
        manualChunks(id){
          if(id.includes('node_modules')){
            if(id.includes('konva')){
              return 'vendor-canvas';
            }

            return 'vendor';
          }
        }
      }
    }
  }
})
