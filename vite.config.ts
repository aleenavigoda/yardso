import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        feed: 'public/feed.html',
        dashboard: 'public/dashboard.html',
        browse: 'public/browse.html',
      }
    }
  }
});