import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4003',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:4003',
        changeOrigin: true
      },
      '/ready': {
        target: 'http://localhost:4003',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../client/dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src')
    }
  }
});
