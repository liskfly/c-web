import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 设为相对路径，适配 qrc:// 或 file:// 协议加载
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5181,
    proxy: {
      '/proxy': {
        target: 'http://10.0.18.43:8082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy/, ''),
      },
      '/aishop': {
        target: 'https://aishop.elecnest.cn',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/aishop/, ''),
      },
    },
  },
})
