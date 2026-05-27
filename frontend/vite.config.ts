import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const renderApiUrl = 'https://dukan-saathi.onrender.com'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: renderApiUrl, changeOrigin: true },
      '/ws': { target: renderApiUrl.replace('https://', 'wss://'), changeOrigin: true, ws: true },
    },
  },
})
