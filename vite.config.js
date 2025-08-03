import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: {},
    process: { env: {} }
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      http: 'stream-http',
      https: 'https-browserify',
      os: 'os-browserify/browser',
      url: 'url/',
      assert: 'assert/'
    }
  }
})