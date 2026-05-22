import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['fiddling-backboard-mace.ngrok-free.dev'],  // ← add this
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})