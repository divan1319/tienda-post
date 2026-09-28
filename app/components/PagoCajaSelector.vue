<script setup lang="ts">
import { formatFechaHora } from '~/utils/fechas'

// «Pagada con efectivo de la caja»: elige el turno abierto de la tienda del que sale el efectivo.
const props = defineProps<{
  tiendaId?: number
  totalCentavos?: number
}>()

const pagar = defineModel<boolean>('pagar', { default: false })
const turnoId = defineModel<number | undefined>('turnoId')

const { data, status } = await useFetch('/api/caja/turnos', {
  query: computed(() => ({ abiertos: 'true', tiendaId: props.tiendaId, limit: 100 })),
  immediate: !!props.tiendaId,
  watch: [() => props.tiendaId]
})

const turnos = computed(() => data.value?.items ?? [])
const items = computed(() => turnos.value.map(t => ({
  value: t.id,
  label: `#${t.id} · ${t.usuario} · disponible ${formatUSD(t.efectivoDisponibleCentavos ?? 0)}`,
  description: `Abierto ${formatFechaHora(t.abiertoAt)}`
})))

const elegido = computed(() => turnos.value.find(t => t.id === turnoId.value))
const excede = computed(() =>
  !!elegido.value && props.totalCentavos !== undefined && props.totalCentavos > (elegido.value.efectivoDisponibleCentavos ?? 0)
)

// Si solo hay un turno abierto, se preselecciona; si el elegido ya no está, se limpia
watch([turnos, pagar], () => {
  if (!pagar.value) {
    turnoId.value = undefined
  } else if (!turnos.value.some(t => t.id === turnoId.value)) {
    turnoId.value = turnos.value.length === 1 ? turnos.value[0]!.id : undefined
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-2">
    <USwitch
      v-model="pagar"
      label="Pagada con efectivo de la caja"
      :disabled="!tiendaId"
    />
    <template v-if="pagar">
      <p
        v-if="status !== 'pending' && !turnos.length"
        class="text-sm text-warning"
      >
        No hay turnos abiertos en esta tienda.
      </p>
      <USelect
        v-else
        v-model="turnoId"
        :items="items"
        placeholder="Elige el turno"
        :loading="status === 'pending'"
        class="w-full"
      />
      <p
        v-if="excede"
        class="text-sm text-error"
      >
        El total supera el efectivo disponible en ese turno.
      </p>
    </template>
  </div>
</template>
