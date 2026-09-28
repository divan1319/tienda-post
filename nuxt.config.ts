// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' }
  },

  css: ['~/assets/css/main.css'],

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
  }
})
