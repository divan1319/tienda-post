<script setup lang="ts">
import type { FiltrosReporte } from '~/composables/useFiltrosReporte'
import { getErrorMessage } from '~/utils/errors'

const props = defineProps<{ filtros: FiltrosReporte }>()
const filtros = toRef(props, 'filtros')

const { data, status, error } = useFetch('/api/reportes/ventas', { query: consultaReporte(filtros), lazy: true })

const etiquetas = computed(() => (data.value?.serie ?? []).map(p => formatPeriodo(p.periodo, data.value!.periodo)))
const maxProducto = computed(() => Math.max(1, ...(data.value?.topProductos ?? []).map(p => p.totalCentavos)))

const sufijo = computed(() => `${filtros.value.tiendaId ? `tienda-${filtros.value.tiendaId}` : 'todas'}_${filtros.value.desde}_${filtros.value.hasta}`)

function exportarTop() {
  if (!data.value) return
  descargarCsv(nombreArchivoCsv('productos-mas-vendidos', sufijo.value), generarCsv(data.value.topProductos, [
    { titulo: 'Producto', valor: p => p.nombre },
    { titulo: 'Unidad', valor: p => p.unidadMedida },
    { titulo: 'Cantidad', valor: p => p.cantidad },
    { titulo: 'Total', valor: p => centavosCsv(p.totalCentavos) }
  ]))
}

function porcentaje(parte: number, total: number) {
  return total ? `${Math.round((parte / total) * 100)} % del total` : '—'
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
          etiqueta="Total vendido"
          :valor="formatUSD(data.totales.totalCentavos)"
        />
        <StatTile
          etiqueta="Ventas"
          :valor="String(data.totales.ventas)"
        />
        <StatTile
          etiqueta="Ticket promedio"
          :valor="formatUSD(data.totales.ticketPromedioCentavos)"
        />
        <StatTile
          etiqueta="Anuladas"
          :valor="String(data.totales.anuladas)"
          detalle="No suman en los totales"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <StatTile
          v-for="m in data.porMetodo"
          :key="m.metodoPago"
          :etiqueta="METODO_PAGO_LABEL[m.metodoPago]"
          :valor="formatUSD(m.totalCentavos)"
          :detalle="`${m.ventas} venta(s) · ${porcentaje(m.totalCentavos, data.totales.totalCentavos)}`"
        />
      </div>

      <GraficaCard
        titulo="Ventas por periodo"
        :archivo="`ventas-por-periodo_${sufijo}`"
        :datos="data.serie"
        :etiquetas="etiquetas"
        :series="[{ clave: 'totalCentavos', nombre: 'Total vendido', color: 'var(--serie-1)' }]"
        :cargando="status === 'pending'"
      />

      <div class="grid gap-4 xl:grid-cols-2">
        <UCard variant="outline">
          <template #header>
            <div class="flex items-center justify-between">
              <SectionLabel>Productos más vendidos</SectionLabel>
              <UButton
                v-if="data.topProductos.length"
                label="CSV"
                icon="i-lucide-download"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="exportarTop"
              />
            </div>
          </template>
          <UEmpty
            v-if="!data.topProductos.length"
            icon="i-lucide-package"
            title="Sin ventas en el periodo"
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
                  Producto
                </th>
                <th class="py-2 text-right font-medium">
                  Cantidad
                </th>
                <th class="w-1/3 py-2 font-medium" />
                <th class="py-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in data.topProductos"
                :key="p.productoId"
                class="border-b border-default last:border-0"
              >
                <td class="py-1.5">
                  {{ p.nombre }}
                </td>
                <td class="carbon-data-mono py-1.5 text-right tabular-nums">
                  {{ formatCantidad(p.cantidad, p.unidadMedida) }} {{ UNIDAD_ABREV[p.unidadMedida] }}
                </td>
                <td class="px-3 py-1.5">
                  <!-- Barra de una sola serie: largo proporcional al total -->
                  <div
                    class="h-2 rounded-r-xs"
                    :style="{ width: `${(p.totalCentavos / maxProducto) * 100}%`, background: 'var(--serie-1)' }"
                  />
                </td>
                <td class="carbon-data-mono py-1.5 text-right tabular-nums">
                  {{ formatUSD(p.totalCentavos) }}
                </td>
              </tr>
            </tbody>
          </table>
        </UCard>

        <UCard
          v-if="data.porTienda.length > 1"
          variant="outline"
        >
          <template #header>
            <SectionLabel>Por tienda</SectionLabel>
          </template>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-muted">
                <th class="py-2 font-medium">
                  Tienda
                </th>
                <th class="py-2 text-right font-medium">
                  Ventas
                </th>
                <th class="py-2 text-right font-medium">
                  Total
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
                  {{ t.ventas }}
                </td>
                <td class="py-1.5 text-right">
                  {{ formatUSD(t.totalCentavos) }}
                </td>
              </tr>
            </tbody>
          </table>
        </UCard>
      </div>
    </template>
  </div>
</template>
