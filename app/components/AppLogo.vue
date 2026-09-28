<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
</script>

<template>
  <NuxtLink
    to="/"
    class="flex items-center gap-2"
  >
    <span class="flex size-8 shrink-0 items-center justify-center rounded-xs bg-primary text-sm font-bold text-inverted">
      TP
    </span>
    <span
      v-if="!collapsed"
      class="text-sm font-semibold tracking-tight text-highlighted"
    >
      Tienda POS
    </span>
  </NuxtLink>
</template>
