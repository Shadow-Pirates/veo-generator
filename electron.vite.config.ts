import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve(__dirname, 'src-main/main.ts')
      },
      rollupOptions: {
        external: ['electron', 'better-sqlite3', 'electron-store', 'uuid', 'https', 'http', 'fs', 'path']
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: resolve(__dirname, 'src-main/preload.ts')
      },
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src')
      }
    }
  }
})
