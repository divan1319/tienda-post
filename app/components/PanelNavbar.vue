<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <UDashboardNavbar :title="title">
    <template #right>
      <TiendaSelector />
      <UColorModeButton class="hidden sm:inline-flex" />
    </template>
  </UDashboardNavbar>
</template>
