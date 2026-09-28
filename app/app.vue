<script setup lang="ts">
import { es } from '@nuxt/ui/locale'

// Textos en español con el código es-SV: números y montos con punto decimal
// ($1,234.50) y fechas dd/mm/aaaa. Con `es` a secas los decimales usan coma.
const locale = extendLocale(es, { name: 'Español (El Salvador)', code: 'es-SV' })

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} | Tienda POS` : 'Tienda POS'
  },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'es'
  }
})
</script>

<template>
  <UApp :locale="locale">
    <NuxtLoadingIndicator
      :throttle="100"
      :height="3"
      color="#0f62fe"
    />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
