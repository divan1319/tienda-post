// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vite-pwa/nuxt'
  ],

  devtools: {
    enabled: true
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' }
  },

  css: ['~/assets/css/main.css', '~/assets/css/print.css', '~/assets/css/graficas.css'],

  colorMode: {
    preference: 'dark'
  },

  // Los valores `{{VAR}}` se expanden desde process.env en tiempo de ejecución
  // (nitro.experimental.envExpansion), así los secretos no quedan en el build
  // y el `.env` conserva los nombres estándar (DATABASE_URL, AWS_*, ...).
  runtimeConfig: {
    databaseUrl: '{{DATABASE_URL}}',
    betterAuthSecret: '{{BETTER_AUTH_SECRET}}',
    betterAuthUrl: '{{BETTER_AUTH_URL}}',
    s3: {
      endpoint: '{{AWS_ENDPOINT_URL_S3}}',
      region: '{{AWS_REGION}}',
      accessKeyId: '{{AWS_ACCESS_KEY_ID}}',
      secretAccessKey: '{{AWS_SECRET_ACCESS_KEY}}',
      bucket: '{{S3_BUCKET}}'
    }
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    experimental: {
      envExpansion: true
    }
  },

  telemetry: false,

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  fonts: {
    families: [
      { name: 'IBM Plex Sans', weights: [300, 400, 500, 600, 700], global: true },
      { name: 'IBM Plex Mono', weights: [400, 500, 600] }
    ]
  },

  // PWA instalable. La app depende del servidor (SSR, sesión y datos en vivo): el service
  // worker solo guarda en caché los recursos estáticos y no sirve páginas sin conexión
  // (el trabajo sin conexión está fuera de la versión 1, ver docs/PLAN.md).
  pwa: {
    // «prompt» y no «autoUpdate»: una recarga automática vaciaría el carrito del POS.
    // La nueva versión se aplica cuando el usuario toca «Actualizar» (PwaActualizacion.vue).
    registerType: 'prompt',
    // Avisar (sin fallar el build) de los archivos que superan el límite del precache
    showMaximumFileSizeToCacheInBytesWarning: true,
    manifest: {
      name: 'Tienda POS',
      short_name: 'Tienda POS',
      description: 'Punto de venta, caja, inventario y reportes de las tiendas.',
      lang: 'es',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#18181b',
      background_color: '#18181b',
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,png,ico,svg,woff2}'],
      // Deja fuera del precache la vista previa de Excel (~1.2 MB, solo la usa el admin
      // al importar productos); se descarga de la red cuando se abre esa página
      maximumFileSizeToCacheInBytes: 1024 * 1024,
      cleanupOutdatedCaches: true
    }
  }
})
