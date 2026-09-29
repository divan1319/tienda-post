<script setup lang="ts">
import type { SerieGrafica } from './GraficaBarras.client.vue'

// Tarjeta de gráfica con su tabla equivalente («Ver tabla»): ningún valor depende
// solo del tooltip ni solo del color.
const props = withDefaults(defineProps<{
  titulo: string
  datos: Record<string, number | string>[]
  etiquetas: string[]
  series: SerieGrafica[]
  apilada?: boolean
  cargando?: boolean
  formato?: (valor: number) => string
}>(), {
  apilada: false,
  cargando: false,
  formato: (valor: number) => formatUSD(valor)
})

const verTabla = ref(false)

const filasTabla = computed(() => props.datos.map((d, i) => ({
  periodo: props.etiquetas[i] ?? '',
  valores: props.series.map(s => props.formato(Number(d[s.clave] ?? 0)))
})))

const vacia = computed(() => props.datos.every(d => props.series.every(s => !Number(d[s.clave] ?? 0))))
</script>

<template>
  <UCard variant="outline">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <SectionLabel>{{ titulo }}</SectionLabel>
        <UButton
          :label="verTabla ? 'Ver gráfica' : 'Ver tabla'"
          :icon="verTabla ? 'i-lucide-chart-column' : 'i-lucide-table'"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="verTabla = !verTabla"
        />
      </div>
    </template>

    <!-- Mientras recarga se mantiene lo anterior, atenuado (sin saltos) -->
    <div :class="cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'">
      <UEmpty
        v-if="vacia && !verTabla"
        icon="i-lucide-chart-column"
        title="Sin movimientos en el periodo"
        variant="naked"
        size="sm"
      />
      <table
        v-else-if="verTabla"
        class="w-full text-sm"
      >
        <thead>
          <tr class="border-b border-default text-left text-muted">
            <th class="py-2 font-medium">
              Periodo
            </th>
            <th
              v-for="s in series"
              :key="s.clave"
              class="py-2 text-right font-medium"
            >
              {{ s.nombre }}
            </th>
          </tr>
        </thead>
        <tbody class="carbon-data-mono tabular-nums">
          <tr
            v-for="f in filasTabla"
            :key="f.periodo"
            class="border-b border-default last:border-0"
          >
            <td class="py-1.5">
              {{ f.periodo }}
            </td>
            <td
              v-for="(v, i) in f.valores"
              :key="i"
              class="py-1.5 text-right"
            >
              {{ v }}
            </td>
          </tr>
        </tbody>
      </table>
      <GraficaBarras
        v-else
        :datos="datos"
        :etiquetas="etiquetas"
        :series="series"
        :apilada="apilada"
        :formato="formato"
        :descripcion="titulo"
      />
    </div>
  </UCard>
</template>
