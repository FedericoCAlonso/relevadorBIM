import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: '/relevadorBIM/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-512x512-maskable.png',
        'apple-touch-icon.png',
        'icons.svg'
      ],
      manifest: {
        name: 'Relevador BIM — Arquitectura y AEA',
        short_name: 'RelevadorBIM',
        description: 'Relevamiento Arquitectónico y Eléctrico AEA en obra con soporte offline',
        id: '/relevadorBIM/',
        start_url: '/relevadorBIM/',
        scope: '/relevadorBIM/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        background_color: '#0f172a',
        theme_color: '#2563eb',
        lang: 'es',
        categories: ['productivity', 'utilities', 'business'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'Relevamiento de Campo',
            short_name: 'Relevar',
            description: 'Iniciar o continuar relevamiento en obra',
            url: './',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,mjs}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      }
    })
  ],
  build: {
    modulePreload: {
      resolveDependencies: (_url, deps) => {
        return deps.filter(
          (dep) => !dep.includes('vendor-pdfjs') && !dep.includes('vendor-mlc-llm')
        );
      }
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('@mlc-ai/web-llm')) {
              return 'vendor-mlc-llm';
            }
            if (id.includes('pdfjs-dist')) {
              return 'vendor-pdfjs';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
