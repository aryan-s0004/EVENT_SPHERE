import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,

    // During local development, proxy /api requests to the Vercel dev server.
    // In production on Vercel, /api is handled by serverless functions on the
    // same domain — no proxy needed and no CORS issues arise.
    proxy: {
      '/api': {
        // Option A: `vercel dev` from project root → use port 3000
        // Option B: old Express backend → use port 5000
        // Change the port to match whichever backend you are running locally.
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
