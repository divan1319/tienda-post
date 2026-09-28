<script setup lang="ts">
const { tiendaId, items } = useTiendaSeleccionada()
</script>

<template>
  <USelect
    v-model="tiendaId"
    :items="items"
    icon="i-lucide-store"
    placeholder="Tienda"
    class="w-48"
  />
</template>
