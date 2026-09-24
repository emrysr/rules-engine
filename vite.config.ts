import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://emrysr.github.io/rules-engine/ — every asset URL needs
// that prefix, so the base path is the repo name. Change it if the repo moves
// or a custom domain is added (then base becomes '/').
const BASE = '/rules-engine/'

export default defineConfig({
  base: BASE,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Config-Driven Rules Engine',
        short_name: 'Rules Engine',
        description:
          'Schema-driven form config, JSON Logic rules and live API data sources, all editable as config.',
        theme_color: '#485fc7',
        // Splash background, matched to the icon's own backdrop so the icon
        // reads as edge-to-edge rather than a tile on white.
        background_color: '#0a2454',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            // Data sources are user-configurable, so match any cross-origin GET
            // rather than hardcoding a host. Network-first keeps data fresh when
            // online but leaves the app usable offline from the last response.
            urlPattern: ({ url, sameOrigin }) =>
              !sameOrigin && url.protocol === 'https:',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'data-sources',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
