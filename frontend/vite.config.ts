import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@zama-fhe/relayer-sdk']
  },
  build: {
    target: 'es2022',
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer used by FHE WASM multi-threading
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      // Proxy Alchemy Sepolia RPC — same-origin to comply with COEP
      '/api/rpc': {
        target: 'https://eth-sepolia.g.alchemy.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rpc/, '/v2/rCMBmb19ivP-P9yRADms9'),
      },
      // Proxy Zama Relayer — correct domain is .org NOT .cloud
      '/api/relayer': {
        target: 'https://relayer.testnet.zama.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/relayer/, ''),
      },
    },
  },
})
