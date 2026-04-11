import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = (env.API_PROXY_TARGET || 'http://localhost:5000').replace(/\/+$/, '');

  return {
    plugins: [react()],

    server: {
      port: 3000,

      // Proxy /api to Express (backend/) during local dev when VITE_API_BASE_URL=/api.
      // Override with API_PROXY_TARGET in frontend/.env.
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
