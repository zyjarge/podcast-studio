import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Port alignment: start.sh negotiates a backend port and exports it via
// PODCAST_BACKEND_PORT. Vite sees the same env (envDir walks up to the
// project root), so the dev proxy always targets the same backend port
// start.sh actually launched - fixing the mismatch in #16.
const PROJECT_ROOT = new URL('..', import.meta.url).pathname
const env = loadEnv(process.env.NODE_ENV || 'development', PROJECT_ROOT, '')

const BACKEND_PORT = parseInt(env.PODCAST_BACKEND_PORT || process.env.PODCAST_BACKEND_PORT || '8002', 10)
const FRONTEND_PORT = parseInt(env.PODCAST_FRONTEND_PORT || process.env.PODCAST_FRONTEND_PORT || '3000', 10)
const BACKEND_TARGET = `http://127.0.0.1:${BACKEND_PORT}`

export default defineConfig({
  plugins: [react()],
  server: {
    // If PORT is set by start.sh we honour it; otherwise we keep the
    // vite default (which is what the dev server prints first).
    port: Number.isFinite(FRONTEND_PORT) && FRONTEND_PORT > 0 ? FRONTEND_PORT : 3000,
    host: true,
    strictPort: false,  // if our chosen port is taken, ask instead of refusing outright
    proxy: {
      // Proxy every /api/v1/* request to the negotiated backend port.
      '/api': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      // /data: backend FileResponse for generated audio paths.
      // /audio: covers /audio/{episode_id}/{filename} audio serving.
      '/data': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/audio': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
