<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ProductoOpcion } from '~/components/ProductoPicker.vue'
import { formatFechaHora } from '~/utils/fechas'
import type { InternalApi } from 'nitropack/types'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Kardex' })

const { tiendaId } = useTiendaSeleccionada()
const producto = ref<ProductoOpcion | undefined>()
const desde = ref('')
const hasta = ref('')

watch(tiendaId, () => {
  producto.value = undefined
})

// Tipo explícito de la respuesta: inferirlo dentro de useAsyncData con la rama
// `Promise.resolve(null)` agota la profundidad de tipos de TypeScript
type MovimientosKardex = InternalApi['/api/inventario/movimientos']['get']

// Solo consulta cuando hay tienda y producto elegidos
const { data: movimientos, status } = await useAsyncData(
  'kardex',
  () => tiendaId.value && producto.value
    ? $fetch<MovimientosKardex>('/api/inventario/movimientos', {
        query: {
          tiendaId: tiendaId.value,
          productoId: producto.value.id,
          desde: desde.value || undefined,
          hasta: hasta.value || undefined,
          limit: 500
        }
      })
    : Promise.resolve(null),
  { watch: [tiendaId, producto, desde, hasta] }
)

type Movimiento = NonNullable<typeof movimientos.value>[number]

const TIPO_LABEL: Record<Movimiento['tipo'], string> = {
  entrada: 'Entrada',
  venta: 'Venta',
  anulacion_venta: 'Anulación de venta',
  ajuste: 'Ajuste'
}

const { items: tiendaItems } = useTiendaSeleccionada()

function exportar() {
  if (!producto.value || !movimientos.value) return
  const tienda = tiendaItems.value.find(t => t.value === tiendaId.value)?.label
  // En pantalla van del más reciente al más antiguo; el archivo, en orden cronológico
  const filas = [...movimientos.value].reverse()
  descargarCsv(nombreArchivoCsv('kardex', producto.value.nombre, tienda, desde.value, hasta.value), generarCsv(filas, [
    { titulo: 'Fecha', valor: m => fechaHoraCsv(m.createdAt) },
    { titulo: 'Tipo', valor: m => TIPO_LABEL[m.tipo] },
    { titulo: 'Cambio', valor: m => m.cantidad },
    { titulo: 'Saldo', valor: m => m.saldo },
    { titulo: 'Unidad', valor: m => m.unidadMedida },
    { titulo: 'Nota', valor: m => m.nota },
    { titulo: 'Usuario', valor: m => m.usuario }
  ]))
}

const columns: TableColumn<Movimiento>[] = [
  { accessorKey: 'createdAt', header: 'Fecha' },
  { accessorKey: 'tipo', header: 'Tipo' },
  { accessorKey: 'cantidad', header: 'Cambio' },
  { accessorKey: 'saldo', header: 'Saldo' },
  { accessorKey: 'nota', header: 'Nota' },
  { accessorKey: 'usuario', header: 'Usuario' }
]
</script>

<template>
  <UDashboardPanel id="kardex">
    <template #header>
      <PanelNavbar title="Kardex" />
    </template>

    <template #body>
      <div class="flex flex-wrap items-end gap-2">
        <TiendaFiltro />
        <div class="w-full sm:w-80">
          <ProductoPicker
            v-model="producto"
            :tienda-id="tiendaId"
          />
        </div>
        <UFormField
          label="Desde"
          class="min-w-0 grow basis-36 sm:grow-0 sm:basis-auto"
        >
          <UInput
            v-model="desde"
            type="date"
            class="w-full sm:w-auto"
          />
        </UFormField>
        <UFormField
          label="Hasta"
          class="min-w-0 grow basis-36 sm:grow-0 sm:basis-auto"
        >
          <UInput
            v-model="hasta"
            type="date"
            class="w-full sm:w-auto"
          />
        </UFormField>
        <UButton
          v-if="producto && movimientos?.length"
          label="Exportar CSV"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          class="w-full justify-center sm:ms-auto sm:w-auto"
          @click="exportar"
        />
      </div>

      <UEmpty
        v-if="!producto"
        icon="i-lucide-scroll-text"
        title="Elige un producto"
        description="El kardex muestra cada movimiento del producto en la tienda y el saldo después de cada uno."
      />

      <template v-else>
        <div class="flex flex-wrap gap-4">
          <UCard
            variant="outline"
            class="w-full sm:w-auto sm:min-w-48"
          >
            <SectionLabel>Stock actual</SectionLabel>
            <p
              class="carbon-data-mono mt-2 text-2xl font-semibold"
              :class="producto.stock < 0 ? 'text-error' : 'text-highlighted'"
            >
              {{ formatCantidad(producto.stock, producto.unidadMedida) }}
              <span class="text-sm text-muted">{{ UNIDAD_ABREV[producto.unidadMedida] }}</span>
            </p>
          </UCard>
        </div>

        <UTable
          :data="movimientos ?? []"
          :columns="columns"
          :loading="status === 'pending'"
          empty="Sin movimientos en el periodo."
          class="border border-default"
        >
          <template #createdAt-cell="{ row }">
            <span class="carbon-data-mono">{{ formatFechaHora(row.original.createdAt) }}</span>
          </template>
          <template #tipo-cell="{ row }">
            <UBadge
              :label="TIPO_LABEL[row.original.tipo]"
              color="neutral"
              variant="outline"
            />
          </template>
          <template #cantidad-cell="{ row }">
            <span
              class="carbon-data-mono"
              :class="row.original.cantidad < 0 ? 'text-error' : 'text-success'"
            >
              {{ row.original.cantidad > 0 ? '+' : '' }}{{ formatCantidad(row.original.cantidad, row.original.unidadMedida) }}
            </span>
          </template>
          <template #saldo-cell="{ row }">
            <span class="carbon-data-mono">{{ formatCantidad(row.original.saldo, row.original.unidadMedida) }}</span>
          </template>
          <template #nota-cell="{ row }">
            <span class="block min-w-40 whitespace-normal text-muted">{{ row.original.nota || '—' }}</span>
          </template>
        </UTable>
      </template>
    </template>
  </UDashboardPanel>
</template>
