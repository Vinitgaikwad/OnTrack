import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 3456,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:7891',
    },
  },
})
