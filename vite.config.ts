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
