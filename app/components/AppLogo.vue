<script setup lang="ts">
defineProps<{
  collapsed?: boolean
  /** Oculta el nombre en pantallas pequeñas (solo queda el distintivo) */
  compactoEnMovil?: boolean
}>()
</script>

<template>
  <NuxtLink
    to="/"
    aria-label="Tienda POS"
    class="flex shrink-0 items-center gap-2"
  >
    <span class="flex size-8 shrink-0 items-center justify-center rounded-xs bg-primary text-sm font-bold text-inverted">
      TP
    </span>
    <span
      v-if="!collapsed"
      class="text-sm font-semibold tracking-tight text-highlighted"
      :class="{ 'hidden sm:inline': compactoEnMovil }"
    >
      Tienda POS
    </span>
  </NuxtLink>
</template>
