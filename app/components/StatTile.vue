<script setup lang="ts">
defineProps<{
  etiqueta: string
  valor: string
  detalle?: string
  tono?: 'normal' | 'error' | 'warning' | 'success'
}>()
</script>

<template>
  <UCard variant="outline">
    <SectionLabel>{{ etiqueta }}</SectionLabel>
    <p
      class="carbon-data-mono mt-2 text-xl font-semibold wrap-anywhere sm:text-2xl"
      :class="{
        'text-highlighted': !tono || tono === 'normal',
        'text-error': tono === 'error',
        'text-warning': tono === 'warning',
        'text-success': tono === 'success'
      }"
    >
      {{ valor }}
    </p>
    <p
      v-if="detalle"
      class="carbon-data-mono text-sm text-muted"
    >
      {{ detalle }}
    </p>
  </UCard>
</template>
