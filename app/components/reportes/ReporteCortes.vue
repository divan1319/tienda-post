<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { FiltrosReporte } from '~/composables/useFiltrosReporte'
import { getErrorMessage } from '~/utils/errors'
import { formatFechaHora } from '~/utils/fechas'

const props = defineProps<{ filtros: FiltrosReporte }>()
const filtros = toRef(props, 'filtros')

const { data, error } = useFetch('/api/reportes/cortes', { query: consultaReporte(filtros), lazy: true })

type Turno = NonNullable<typeof data.value>['turnos'][number]
const columns: TableColumn<Turno>[] = [
  { accessorKey: 'id', header: '#' },
  { accessorKey: 'tiendaNombre', header: 'Tienda' },
  { accessorKey: 'usuario', header: 'Usuario' },
  { accessorKey: 'abiertoAt', header: 'Abierto' },
  { accessorKey: 'montoInicialCentavos', header: 'Inicial' },
  { accessorKey: 'ventasEfectivoCentavos', header: 'Ventas efectivo' },
  { accessorKey: 'salidasCentavos', header: 'Salidas' },
  { accessorKey: 'efectivoEsperadoCentavos', header: 'Esperado' },
  { accessorKey: 'efectivoContadoCentavos', header: 'Contado' },
  { accessorKey: 'diferenciaCentavos', header: 'Diferencia' }
]

function exportar() {
  if (!data.value) return
  const f = filtros.value
  descargarCsv(nombreArchivoCsv('cortes-de-caja', f.tiendaId ? `tienda-${f.tiendaId}` : 'todas', f.desde, f.hasta), generarCsv(data.value.turnos, [
    { titulo: 'Turno', valor: t => t.id },
    { titulo: 'Tienda', valor: t => t.tiendaNombre },
    { titulo: 'Usuario', valor: t => t.usuario },
    { titulo: 'Abierto', valor: t => fechaHoraCsv(t.abiertoAt) },
    { titulo: 'Cerrado', valor: t => fechaHoraCsv(t.cerradoAt) },
    { titulo: 'Inicial', valor: t => centavosCsv(t.montoInicialCentavos) },
    { titulo: 'Ventas en efectivo', valor: t => centavosCsv(t.ventasEfectivoCentavos) },
    { titulo: 'Salidas', valor: t => centavosCsv(t.salidasCentavos) },
    { titulo: 'Esperado', valor: t => centavosCsv(t.efectivoEsperadoCentavos) },
    { titulo: 'Contado', valor: t => centavosCsv(t.efectivoContadoCentavos) },
    { titulo: 'Diferencia', valor: t => centavosCsv(t.diferenciaCentavos) }
  ]))
}

function colorDiferencia(d: number | null) {
  if (d === null || d === 0) return 'text-success'
  return d < 0 ? 'text-error' : 'text-warning'
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="getErrorMessage(error, 'No se pudo cargar el reporte')"
    />

    <template v-if="data">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Turnos"
          :valor="String(data.totales.turnos)"
          :detalle="`${data.totales.cerrados} cerrado(s)`"
        />
        <StatTile
          etiqueta="Faltantes"
          :valor="formatUSD(data.totales.faltantesCentavos)"
          :tono="data.totales.faltantesCentavos < 0 ? 'error' : 'normal'"
        />
        <StatTile
          etiqueta="Sobrantes"
          :valor="formatUSD(data.totales.sobrantesCentavos)"
          :tono="data.totales.sobrantesCentavos > 0 ? 'warning' : 'normal'"
        />
        <StatTile
          etiqueta="Diferencia neta"
          :valor="formatUSD(data.totales.diferenciaNetaCentavos)"
        />
      </div>

      <UCard variant="outline">
        <template #header>
          <div class="flex items-center justify-between">
            <SectionLabel>Turnos <span class="carbon-data-mono">({{ data.turnos.length }})</span></SectionLabel>
            <UButton
              v-if="data.turnos.length"
              label="CSV"
              icon="i-lucide-download"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="exportar"
            />
          </div>
        </template>
        <UTable
          :data="data.turnos"
          :columns="columns"
          empty="Sin turnos en el periodo."
        >
          <template #id-cell="{ row }">
            <span class="carbon-data-mono">{{ row.original.id }}</span>
          </template>
          <template #abiertoAt-cell="{ row }">
            <span class="carbon-data-mono">{{ formatFechaHora(row.original.abiertoAt) }}</span>
            <UBadge
              v-if="row.original.abierto"
              label="Abierto"
              color="success"
              variant="subtle"
              class="ms-1"
            />
          </template>
          <template #montoInicialCentavos-cell="{ row }">
            <span class="carbon-data-mono">{{ formatUSD(row.original.montoInicialCentavos) }}</span>
          </template>
          <template #ventasEfectivoCentavos-cell="{ row }">
            <span class="carbon-data-mono">{{ formatUSD(row.original.ventasEfectivoCentavos) }}</span>
          </template>
          <template #salidasCentavos-cell="{ row }">
            <span class="carbon-data-mono">{{ formatUSD(row.original.salidasCentavos) }}</span>
          </template>
          <template #efectivoEsperadoCentavos-cell="{ row }">
            <span class="carbon-data-mono">{{ formatUSD(row.original.efectivoEsperadoCentavos) }}</span>
            <UTooltip
              v-if="row.original.cambioDespuesDelCierre"
              text="Se anuló una venta en efectivo después del cierre; el esperado es el guardado al cerrar."
            >
              <UIcon
                name="i-lucide-info"
                class="ms-1 align-middle text-warning"
              />
            </UTooltip>
          </template>
          <template #efectivoContadoCentavos-cell="{ row }">
            <span class="carbon-data-mono">{{ row.original.efectivoContadoCentavos !== null ? formatUSD(row.original.efectivoContadoCentavos) : '—' }}</span>
          </template>
          <template #diferenciaCentavos-cell="{ row }">
            <span
              v-if="row.original.diferenciaCentavos !== null"
              class="carbon-data-mono font-semibold"
              :class="colorDiferencia(row.original.diferenciaCentavos)"
            >
              {{ row.original.diferenciaCentavos > 0 ? '+' : '' }}{{ formatUSD(row.original.diferenciaCentavos) }}
            </span>
            <span
              v-else
              class="text-muted"
            >—</span>
          </template>
        </UTable>
      </UCard>
    </template>
  </div>
</template>
