<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ProductoOpcion } from '~/components/ProductoPicker.vue'
import { getErrorMessage } from '~/utils/errors'
import { formatFechaHora } from '~/utils/fechas'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Ajustes de inventario' })

const toast = useToast()
const { tiendaId } = useTiendaSeleccionada()

type Modo = 'conteo' | 'salida' | 'entrada'

const modos: { label: string, value: Modo, description: string }[] = [
  { label: 'Conteo físico', value: 'conteo', description: 'El stock queda igual a lo contado.' },
  { label: 'Salida', value: 'salida', description: 'Merma, vencido o transferencia a otra tienda.' },
  { label: 'Entrada', value: 'entrada', description: 'Corrección positiva o transferencia desde otra tienda.' }
]

const producto = ref<ProductoOpcion | undefined>()
const modo = ref<Modo>('conteo')
const cantidad = ref<number | undefined>()
const motivo = ref('')
const guardando = ref(false)
const pickerKey = ref(0)

watch(tiendaId, () => {
  producto.value = undefined
})

const error = computed(() => {
  if (!producto.value || cantidad.value === undefined) return null
  return validarCantidad(cantidad.value, producto.value.unidadMedida, { permitirCero: modo.value === 'conteo' })
})

const valido = computed(() =>
  !!tiendaId.value && !!producto.value && cantidad.value !== undefined && !error.value && motivo.value.trim().length >= 3
)

// Vista previa de cómo queda el stock
const stockResultante = computed(() => {
  if (!producto.value || cantidad.value === undefined) return null
  if (modo.value === 'conteo') return cantidad.value
  const delta = modo.value === 'salida' ? -cantidad.value : cantidad.value
  return restarCantidades(producto.value.stock, -delta)
})

const { data: recientes, status, refresh } = await useFetch('/api/inventario/movimientos', {
  query: computed(() => ({ tiendaId: tiendaId.value, tipo: 'ajuste', limit: 50 })),
  immediate: !!tiendaId.value
})

type Movimiento = NonNullable<typeof recientes.value>[number]

const columns: TableColumn<Movimiento>[] = [
  { accessorKey: 'createdAt', header: 'Fecha' },
  { accessorKey: 'productoNombre', header: 'Producto' },
  { accessorKey: 'cantidad', header: 'Cambio' },
  { accessorKey: 'saldo', header: 'Saldo' },
  { accessorKey: 'nota', header: 'Motivo' },
  { accessorKey: 'usuario', header: 'Registró' }
]

async function guardar() {
  if (!valido.value) return
  guardando.value = true
  try {
    const res = await $fetch('/api/inventario/ajustes', {
      method: 'POST',
      body: {
        tiendaId: tiendaId.value,
        productoId: producto.value!.id,
        modo: modo.value,
        cantidad: cantidad.value,
        motivo: motivo.value
      }
    })
    toast.add({
      title: res.sinCambios ? 'El conteo coincide con el stock; no se registró ajuste' : 'Ajuste registrado',
      color: res.sinCambios ? 'info' : 'success'
    })
    producto.value = undefined
    cantidad.value = undefined
    motivo.value = ''
    // Recarga el buscador para que muestre el stock nuevo
    pickerKey.value++
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo registrar el ajuste'), color: 'error' })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="ajustes">
    <template #header>
      <PanelNavbar title="Ajustes de inventario" />
    </template>

    <template #body>
      <div class="flex items-center gap-2">
        <TiendaFiltro />
      </div>

      <UCard variant="outline">
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="space-y-4">
            <UFormField
              label="Producto"
              required
            >
              <ProductoPicker
                :key="pickerKey"
                v-model="producto"
                :tienda-id="tiendaId"
              />
            </UFormField>
            <UFormField
              label="Tipo de ajuste"
              required
            >
              <URadioGroup
                v-model="modo"
                :items="modos"
              />
            </UFormField>
          </div>

          <div class="space-y-4">
            <UFormField
              :label="modo === 'conteo' ? 'Cantidad contada' : 'Cantidad'"
              :error="error ?? undefined"
              required
            >
              <div class="flex items-center gap-2">
                <CantidadInput
                  v-model="cantidad"
                  :unidad="producto?.unidadMedida ?? 'unidad'"
                  :permitir-cero="modo === 'conteo'"
                  :disabled="!producto"
                  class="w-40"
                />
                <span
                  v-if="producto"
                  class="text-sm text-muted"
                >{{ UNIDAD_ABREV[producto.unidadMedida] }}</span>
              </div>
            </UFormField>
            <UFormField
              label="Motivo"
              required
              help="Por ejemplo: conteo mensual, producto vencido, transferencia a otra tienda."
            >
              <UTextarea
                v-model="motivo"
                :rows="2"
                class="w-full"
              />
            </UFormField>
            <div
              v-if="producto"
              class="carbon-data-mono text-sm"
            >
              <span class="text-muted">Stock actual:</span>
              {{ formatCantidad(producto.stock, producto.unidadMedida) }}
              <template v-if="stockResultante !== null">
                <span class="text-muted"> → queda:</span>
                <span :class="stockResultante < 0 ? 'text-error' : 'text-highlighted'">
                  {{ formatCantidad(stockResultante, producto.unidadMedida) }}
                </span>
              </template>
            </div>
            <UButton
              label="Registrar ajuste"
              :loading="guardando"
              :disabled="!valido"
              @click="guardar"
            />
          </div>
        </div>
      </UCard>

      <SectionLabel>Ajustes recientes</SectionLabel>
      <UTable
        :data="recientes ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        empty="No hay ajustes en esta tienda."
        class="border border-default"
      >
        <template #createdAt-cell="{ row }">
          <span class="carbon-data-mono">{{ formatFechaHora(row.original.createdAt) }}</span>
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
      </UTable>
    </template>
  </UDashboardPanel>
</template>
