import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/zippygo': {
        target: 'https://zippygotransfers.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zippygo/, ''),
      },
      '/api/zippygo-backend': {
        target: 'https://zippygo-transfers-backend.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zippygo-backend/, ''),
      },
    },
  },
});
