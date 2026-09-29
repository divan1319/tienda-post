<script setup lang="ts">
import type { FiltrosReporte } from '~/composables/useFiltrosReporte'
import { getErrorMessage } from '~/utils/errors'

const props = defineProps<{ filtros: FiltrosReporte }>()
const filtros = toRef(props, 'filtros')

const { data, status, error } = useFetch('/api/reportes/resumen', { query: consultaReporte(filtros), lazy: true })

const sufijo = computed(() => `${filtros.value.tiendaId ? `tienda-${filtros.value.tiendaId}` : 'todas'}_${filtros.value.desde}_${filtros.value.hasta}`)

function exportarTiendas() {
  if (!data.value) return
  descargarCsv(nombreArchivoCsv('resumen-por-tienda', sufijo.value), generarCsv(data.value.porTienda, [
    { titulo: 'Tienda', valor: t => t.nombre },
    { titulo: 'Ventas', valor: t => centavosCsv(t.ventasCentavos) },
    { titulo: 'Compras', valor: t => centavosCsv(t.comprasCentavos) },
    { titulo: 'Ventas - compras', valor: t => centavosCsv(t.flujoCentavos) }
  ]))
}

const etiquetas = computed(() => (data.value?.serie ?? []).map(p => formatPeriodo(p.periodo, data.value!.periodo)))
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
      <div class="grid gap-4 sm:grid-cols-3">
        <StatTile
          etiqueta="Ventas"
          :valor="formatUSD(data.totales.ventasCentavos)"
        />
        <StatTile
          etiqueta="Compras"
          :valor="formatUSD(data.totales.comprasCentavos)"
        />
        <StatTile
          etiqueta="Ventas − compras"
          :valor="formatUSD(data.totales.flujoCentavos)"
          :tono="data.totales.flujoCentavos < 0 ? 'error' : 'normal'"
          detalle="Flujo de caja, no ganancia"
        />
      </div>

      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="Las compras no guardan productos: la diferencia entre ventas y compras es flujo de caja, no ganancia real."
      />

      <GraficaCard
        titulo="Ventas vs. compras por periodo"
        :archivo="`ventas-vs-compras_${sufijo}`"
        :datos="data.serie"
        :etiquetas="etiquetas"
        :series="[
          { clave: 'ventasCentavos', nombre: 'Ventas', color: 'var(--serie-1)' },
          { clave: 'comprasCentavos', nombre: 'Compras', color: 'var(--serie-2)' }
        ]"
        :cargando="status === 'pending'"
      />

      <UCard variant="outline">
        <template #header>
          <div class="flex items-center justify-between">
            <SectionLabel>Por tienda</SectionLabel>
            <UButton
              v-if="data.porTienda.length"
              label="CSV"
              icon="i-lucide-download"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="exportarTiendas"
            />
          </div>
        </template>
        <UEmpty
          v-if="!data.porTienda.length"
          icon="i-lucide-store"
          title="Sin movimientos en el periodo"
          variant="naked"
          size="sm"
        />
        <table
          v-else
          class="w-full text-sm"
        >
          <thead>
            <tr class="border-b border-default text-left text-muted">
              <th class="py-2 font-medium">
                Tienda
              </th>
              <th class="py-2 text-right font-medium">
                Ventas
              </th>
              <th class="py-2 text-right font-medium">
                Compras
              </th>
              <th class="py-2 text-right font-medium">
                Ventas − compras
              </th>
            </tr>
          </thead>
          <tbody class="carbon-data-mono tabular-nums">
            <tr
              v-for="t in data.porTienda"
              :key="t.tiendaId"
              class="border-b border-default last:border-0"
            >
              <td class="py-1.5 font-sans">
                {{ t.nombre }}
              </td>
              <td class="py-1.5 text-right">
                {{ formatUSD(t.ventasCentavos) }}
              </td>
              <td class="py-1.5 text-right">
                {{ formatUSD(t.comprasCentavos) }}
              </td>
              <td
                class="py-1.5 text-right"
                :class="t.flujoCentavos < 0 ? 'text-error' : ''"
              >
                {{ formatUSD(t.flujoCentavos) }}
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </template>
  </div>
</template>
