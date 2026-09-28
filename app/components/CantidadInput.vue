<script setup lang="ts">
// Cantidad según la unidad: enteros para `unidad`, hasta tres decimales para libra y litro.
const props = defineProps<{
  unidad: UnidadMedida
  permitirCero?: boolean
}>()

const modelValue = defineModel<number | undefined>()

const decimales = computed(() => props.unidad === 'unidad' ? 0 : 3)
</script>

<template>
  <UInputNumber
    v-model="modelValue"
    :min="permitirCero ? 0 : (unidad === 'unidad' ? 1 : 0.001)"
    :step="unidad === 'unidad' ? 1 : 0.5"
    :step-snapping="false"
    :format-options="{ minimumFractionDigits: 0, maximumFractionDigits: decimales }"
    class="carbon-data-mono"
  />
</template>
