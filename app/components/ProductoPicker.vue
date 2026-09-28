<script setup lang="ts">
// Buscador de productos activos por nombre o código de barras (filtra en el cliente).
export interface ProductoOpcion {
  id: number
  nombre: string
  codigoBarras: string | null
  unidadMedida: UnidadMedida
  stock: number
}

const props = defineProps<{
  tiendaId?: number
  placeholder?: string
}>()

const modelValue = defineModel<ProductoOpcion | undefined>()

const { data, status } = await useFetch('/api/productos', {
  query: computed(() => ({ tiendaId: props.tiendaId, limit: 1000 })),
  immediate: !!props.tiendaId,
  watch: [() => props.tiendaId]
})

const items = computed<ProductoOpcion[]>(() => (data.value?.items ?? []).map(p => ({
  id: p.id,
  nombre: p.nombre,
  codigoBarras: p.codigoBarras,
  unidadMedida: p.unidadMedida,
  stock: p.stock
})))
</script>

<template>
  <UInputMenu
    v-model="modelValue"
    :items="items"
    label-key="nombre"
    :filter-fields="['nombre', 'codigoBarras']"
    :loading="status === 'pending'"
    :placeholder="placeholder ?? 'Buscar por nombre o código'"
    icon="i-lucide-search"
    class="w-full"
  >
    <template #item-label="{ item }">
      <span>{{ item.nombre }}</span>
      <span class="carbon-data-mono ms-2 text-xs text-muted">
        {{ formatCantidad(item.stock, item.unidadMedida) }} {{ UNIDAD_ABREV[item.unidadMedida] }}
      </span>
    </template>
  </UInputMenu>
</template>
