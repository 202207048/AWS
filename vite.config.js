import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PORT: API 서버 포트(기본 8787), WEB_PORT: 화면 포트(기본 5173)
// 여러 개를 동시에 띄울 때만 바꿔 쓴다.
const apiPort = Number(process.env.PORT) || 8787
const webPort = Number(process.env.WEB_PORT) || 5173

export default defineConfig({
  plugins: [react()],
  server: {
    port: webPort,
    // 시연용 임시 공개 주소(Cloudflare quick tunnel)로 접속할 수 있게 허용
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
      },
    },
  },
})
