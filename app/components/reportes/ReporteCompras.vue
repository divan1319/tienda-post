<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { FiltrosReporte } from '~/composables/useFiltrosReporte'
import { getErrorMessage } from '~/utils/errors'

const props = defineProps<{ filtros: FiltrosReporte }>()
const filtros = toRef(props, 'filtros')

const { data, status, error } = useFetch('/api/reportes/compras', { query: consultaReporte(filtros), lazy: true })

const etiquetas = computed(() => (data.value?.serie ?? []).map(p => formatPeriodo(p.periodo, data.value!.periodo)))

type Factura = NonNullable<typeof data.value>['facturas'][number]
const columns: TableColumn<Factura>[] = [
  { accessorKey: 'fechaCompra', header: 'Fecha' },
  { accessorKey: 'nombre', header: 'Compra' },
  { accessorKey: 'tiendaNombre', header: 'Tienda' },
  { accessorKey: 'numeroFactura', header: 'Factura' },
  { accessorKey: 'turnoPagoId', header: 'Pago' },
  { accessorKey: 'totalCentavos', header: 'Total' }
]

const sufijo = computed(() => `${filtros.value.tiendaId ? `tienda-${filtros.value.tiendaId}` : 'todas'}_${filtros.value.desde}_${filtros.value.hasta}`)

function exportarFacturas() {
  if (!data.value) return
  descargarCsv(nombreArchivoCsv('facturas', sufijo.value), generarCsv(data.value.facturas, [
    { titulo: 'Fecha', valor: f => f.fechaCompra },
    { titulo: 'Tienda', valor: f => f.tiendaNombre },
    { titulo: 'Tipo', valor: f => f.tipo === 'pedido' ? 'con pedido' : 'directa' },
    { titulo: 'Compra', valor: f => f.nombre },
    { titulo: 'Proveedor', valor: f => f.proveedor },
    { titulo: 'Factura', valor: f => f.numeroFactura },
    { titulo: 'Pagada con caja', valor: f => f.turnoPagoId ? `turno ${f.turnoPagoId}` : 'no' },
    { titulo: 'Total', valor: f => centavosCsv(f.totalCentavos) }
  ]))
}

function formatFecha(fecha: string) {
  const [a, m, d] = fecha.split('-')
  return `${d}/${m}/${a}`
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
          etiqueta="Total comprado"
          :valor="formatUSD(data.totales.totalCentavos)"
          :detalle="`${data.totales.compras} compra(s)`"
        />
        <StatTile
          etiqueta="Con pedido"
          :valor="formatUSD(data.totales.conPedidoCentavos)"
        />
        <StatTile
          etiqueta="Directas"
          :valor="formatUSD(data.totales.directasCentavos)"
        />
        <StatTile
          etiqueta="Pagado con efectivo de caja"
          :valor="formatUSD(data.totales.pagadoConCajaCentavos)"
        />
      </div>

      <GraficaCard
        titulo="Compras por periodo"
        :archivo="`compras-por-periodo_${sufijo}`"
        :datos="data.serie"
        :etiquetas="etiquetas"
        :series="[
          { clave: 'conPedidoCentavos', nombre: 'Con pedido', color: 'var(--serie-1)' },
          { clave: 'directasCentavos', nombre: 'Directas', color: 'var(--serie-2)' }
        ]"
        apilada
        :cargando="status === 'pending'"
      />

      <UCard variant="outline">
        <template #header>
          <div class="flex items-center justify-between">
            <SectionLabel>Facturas del periodo <span class="carbon-data-mono">({{ data.facturas.length }})</span></SectionLabel>
            <UButton
              v-if="data.facturas.length"
              label="CSV"
              icon="i-lucide-download"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="exportarFacturas"
            />
          </div>
        </template>
        <UTable
          :data="data.facturas"
          :columns="columns"
          empty="Sin compras en el periodo."
        >
          <template #fechaCompra-cell="{ row }">
            <span class="carbon-data-mono">{{ formatFecha(row.original.fechaCompra) }}</span>
          </template>
          <template #nombre-cell="{ row }">
            {{ row.original.nombre }}
            <span class="text-xs text-muted">· {{ row.original.tipo === 'pedido' ? 'con pedido' : 'directa' }}{{ row.original.proveedor ? ` · ${row.original.proveedor}` : '' }}</span>
          </template>
          <template #numeroFactura-cell="{ row }">
            <ULink
              v-if="row.original.comprobanteKey"
              :to="`/api/files/${row.original.comprobanteKey}`"
              target="_blank"
              external
              class="carbon-data-mono"
            >
              {{ row.original.numeroFactura || 'Comprobante' }}
            </ULink>
            <span
              v-else
              class="carbon-data-mono text-muted"
            >{{ row.original.numeroFactura || '—' }}</span>
          </template>
          <template #turnoPagoId-cell="{ row }">
            <span :class="row.original.turnoPagoId ? '' : 'text-muted'">
              {{ row.original.turnoPagoId ? `Caja · turno #${row.original.turnoPagoId}` : '—' }}
            </span>
          </template>
          <template #totalCentavos-cell="{ row }">
            <span class="carbon-data-mono">{{ formatUSD(row.original.totalCentavos) }}</span>
          </template>
        </UTable>
      </UCard>
    </template>
  </div>
</template>
