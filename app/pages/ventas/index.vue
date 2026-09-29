<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { VentaTicket } from '#shared/types/ventas'
import { getErrorMessage } from '~/utils/errors'
import { formatFechaHora } from '~/utils/fechas'

useSeoMeta({ title: 'Ventas' })

const toast = useToast()
const { esAdmin } = useUsuario()
const { estado } = useTiendaActiva()

// ---------- Filtros ----------

const tiendaFiltro = ref<string>('todas')
const estadoFiltro = ref<string>('todos')
const desde = ref(hoyLocal())
const hasta = ref(hoyLocal())
const pagina = ref(1)
const POR_PAGINA = 50

const tiendaItems = computed(() => [
  { label: 'Todas las tiendas', value: 'todas' },
  ...estado.value.tiendas.map(t => ({ label: t.nombre, value: String(t.id) }))
])
const estadoItems = [
  { label: 'Todas', value: 'todos' },
  { label: 'Completadas', value: 'completada' },
  { label: 'Anuladas', value: 'anulada' }
]

// Exportación con los mismos filtros que la tabla (una fila por venta o por producto)
const consultaExportar = computed(() => ({
  tiendaId: esAdmin.value && tiendaFiltro.value !== 'todas' ? tiendaFiltro.value : undefined,
  estado: estadoFiltro.value === 'todos' ? undefined : estadoFiltro.value,
  desde: desde.value || undefined,
  hasta: hasta.value || undefined
}))
const exportarItems = computed(() => [[
  { label: 'Una fila por venta', icon: 'i-lucide-receipt', to: urlExportacion('/api/ventas/exportar', consultaExportar.value), external: true, download: true },
  { label: 'Una fila por producto vendido', icon: 'i-lucide-list', to: urlExportacion('/api/ventas/exportar', { ...consultaExportar.value, nivel: 'linea' }), external: true, download: true }
]])

watch([tiendaFiltro, estadoFiltro, desde, hasta], () => {
  pagina.value = 1
})

const { data, status, refresh } = await useFetch('/api/ventas', {
  query: computed(() => ({
    tiendaId: esAdmin.value && tiendaFiltro.value !== 'todas' ? tiendaFiltro.value : undefined,
    estado: estadoFiltro.value === 'todos' ? undefined : estadoFiltro.value,
    desde: desde.value || undefined,
    hasta: hasta.value || undefined,
    limit: POR_PAGINA,
    offset: (pagina.value - 1) * POR_PAGINA
  }))
})

type Fila = NonNullable<typeof data.value>['items'][number]

const columns = computed<TableColumn<Fila>[]>(() => [
  { accessorKey: 'correlativo', header: 'Ticket' },
  { accessorKey: 'createdAt', header: 'Fecha' },
  ...(esAdmin.value
    ? [{ accessorKey: 'tiendaNombre', header: 'Tienda' }, { accessorKey: 'vendedor', header: 'Vendedor' }] as TableColumn<Fila>[]
    : []),
  { accessorKey: 'metodoPago', header: 'Pago' },
  { accessorKey: 'totalCentavos', header: 'Total' },
  { accessorKey: 'estado', header: 'Estado' },
  // Sin `header`: un string vacío provoca un desajuste de hidratación en UTable
  { id: 'acciones' }
])

// ---------- Detalle ----------

const seleccionada = ref<VentaTicket | null>(null)

async function ver(id: number) {
  try {
    seleccionada.value = await $fetch<VentaTicket>(`/api/ventas/${id}`)
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo cargar la venta'), color: 'error' })
  }
}

async function onActualizada(v: VentaTicket) {
  seleccionada.value = v
  await refresh()
}
</script>

<template>
  <UDashboardPanel id="ventas">
    <template #header>
      <PanelNavbar title="Ventas" />
    </template>

    <template #body>
      <div class="flex flex-wrap items-end gap-2">
        <UFormField
          v-if="esAdmin"
          label="Tienda"
        >
          <USelect
            v-model="tiendaFiltro"
            :items="tiendaItems"
            class="w-52"
          />
        </UFormField>
        <UFormField label="Estado">
          <USelect
            v-model="estadoFiltro"
            :items="estadoItems"
            class="w-40"
          />
        </UFormField>
        <UFormField label="Desde">
          <UInput
            v-model="desde"
            type="date"
          />
        </UFormField>
        <UFormField label="Hasta">
          <UInput
            v-model="hasta"
            type="date"
          />
        </UFormField>
        <div class="ms-auto">
          <UDropdownMenu :items="exportarItems">
            <UButton
              label="Exportar CSV"
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-chevron-down"
            />
          </UDropdownMenu>
        </div>
      </div>

      <div class="flex flex-wrap gap-4">
        <UCard
          variant="outline"
          class="min-w-48"
        >
          <SectionLabel>Ventas completadas</SectionLabel>
          <p class="carbon-data-mono mt-2 text-2xl font-semibold text-highlighted">
            {{ data?.resumen.ventas ?? 0 }}
          </p>
        </UCard>
        <UCard
          variant="outline"
          class="min-w-48"
        >
          <SectionLabel>Total vendido</SectionLabel>
          <p class="carbon-data-mono mt-2 text-2xl font-semibold text-highlighted">
            {{ formatUSD(data?.resumen.totalCentavos ?? 0) }}
          </p>
        </UCard>
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        empty="No hay ventas en el periodo."
        class="border border-default"
      >
        <template #correlativo-cell="{ row }">
          <span class="carbon-data-mono">#{{ formatCorrelativo(row.original.correlativo) }}</span>
        </template>
        <template #createdAt-cell="{ row }">
          <span class="carbon-data-mono">{{ formatFechaHora(row.original.createdAt) }}</span>
        </template>
        <template #metodoPago-cell="{ row }">
          {{ METODO_PAGO_LABEL[row.original.metodoPago] }}
        </template>
        <template #totalCentavos-cell="{ row }">
          <span
            class="carbon-data-mono"
            :class="row.original.estado === 'anulada' ? 'text-muted line-through' : ''"
          >
            {{ formatUSD(row.original.totalCentavos) }}
          </span>
        </template>
        <template #estado-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UBadge
              :label="row.original.estado === 'anulada' ? 'Anulada' : 'Completada'"
              :color="row.original.estado === 'anulada' ? 'error' : 'success'"
              variant="subtle"
            />
            <UBadge
              v-if="row.original.conStockInsuficiente"
              label="Sin stock"
              color="warning"
              variant="subtle"
            />
          </div>
        </template>
        <template #acciones-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              icon="i-lucide-eye"
              color="neutral"
              variant="ghost"
              aria-label="Ver venta"
              @click="ver(row.original.id)"
            />
          </div>
        </template>
      </UTable>

      <div
        v-if="(data?.total ?? 0) > POR_PAGINA"
        class="flex justify-end"
      >
        <UPagination
          v-model:page="pagina"
          :total="data?.total ?? 0"
          :items-per-page="POR_PAGINA"
        />
      </div>

      <USlideover
        :open="!!seleccionada"
        title="Detalle de venta"
        @update:open="(v) => { if (!v) seleccionada = null }"
      >
        <template #body>
          <VentaDetalle
            v-if="seleccionada"
            :venta="seleccionada"
            @actualizada="onActualizada"
          />
        </template>
      </USlideover>
    </template>
  </UDashboardPanel>
</template>
