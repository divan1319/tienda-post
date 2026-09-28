<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ProductoOpcion } from '~/components/ProductoPicker.vue'
import { getErrorMessage } from '~/utils/errors'
import { formatFechaHora } from '~/utils/fechas'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Entradas de inventario' })

const toast = useToast()
const { tiendaId, items: tiendaItems } = useTiendaSeleccionada()

// ---------- Listado ----------

const POR_PAGINA = 25
const pagina = ref(1)
watch(tiendaId, () => {
  pagina.value = 1
})

const { data, status, refresh } = await useFetch('/api/inventario/entradas', {
  query: computed(() => ({
    tiendaId: tiendaId.value,
    limit: POR_PAGINA,
    offset: (pagina.value - 1) * POR_PAGINA
  }))
})

type Entrada = NonNullable<typeof data.value>['items'][number]

const columns: TableColumn<Entrada>[] = [
  { accessorKey: 'id', header: '#' },
  { accessorKey: 'createdAt', header: 'Fecha' },
  { accessorKey: 'tiendaNombre', header: 'Tienda' },
  { accessorKey: 'usuario', header: 'Registró' },
  { accessorKey: 'lineas', header: 'Productos' },
  { accessorKey: 'nota', header: 'Nota' },
  // Sin `header`: un string vacío provoca un desajuste de hidratación en UTable
  { id: 'acciones' }
]

// ---------- Detalle ----------

const detalleId = ref<number | null>(null)
const detalleAbierto = computed({
  get: () => detalleId.value !== null,
  set: (v) => {
    if (!v) detalleId.value = null
  }
})
const { data: detalle, status: detalleStatus } = await useAsyncData(
  'entrada-detalle',
  () => detalleId.value ? $fetch(`/api/inventario/entradas/${detalleId.value}`) : Promise.resolve(null),
  { watch: [detalleId] }
)

// ---------- Nueva entrada ----------

interface Linea {
  producto: ProductoOpcion
  cantidad: number | undefined
}

const abierto = ref(false)
const guardando = ref(false)
const tiendaEntrada = ref<number | undefined>()
const nota = ref('')
const lineas = ref<Linea[]>([])
const seleccionado = ref<ProductoOpcion | undefined>()

function abrir() {
  tiendaEntrada.value = tiendaId.value
  nota.value = ''
  lineas.value = []
  abierto.value = true
}

// Al elegir un producto se agrega la línea (o se enfoca la existente)
watch(seleccionado, (p) => {
  if (!p) return
  if (!lineas.value.some(l => l.producto.id === p.id)) {
    lineas.value.push({ producto: p, cantidad: undefined })
  }
  nextTick(() => {
    seleccionado.value = undefined
  })
})

function quitar(i: number) {
  lineas.value.splice(i, 1)
}

const errores = computed(() => lineas.value.map(l =>
  l.cantidad === undefined ? 'Falta la cantidad' : validarCantidad(l.cantidad, l.producto.unidadMedida)
))
const valida = computed(() => !!tiendaEntrada.value && lineas.value.length > 0 && errores.value.every(e => !e))

// Atajo desde «Recibir pedido»: /inventario/entradas?nueva=1&tiendaId=…&nota=…
const route = useRoute()
onMounted(() => {
  if (route.query.nueva !== '1') return
  abrir()
  const tienda = Number(route.query.tiendaId)
  if (tiendaItems.value.some(t => t.value === tienda)) tiendaEntrada.value = tienda
  if (typeof route.query.nota === 'string') nota.value = route.query.nota
  navigateTo({ query: {} }, { replace: true })
})

async function guardar() {
  if (!valida.value) return
  guardando.value = true
  try {
    await $fetch('/api/inventario/entradas', {
      method: 'POST',
      body: {
        tiendaId: tiendaEntrada.value,
        nota: nota.value || null,
        lineas: lineas.value.map(l => ({ productoId: l.producto.id, cantidad: l.cantidad! }))
      }
    })
    toast.add({ title: 'Entrada registrada', color: 'success' })
    abierto.value = false
    tiendaId.value = tiendaEntrada.value
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo registrar la entrada'), color: 'error' })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="entradas">
    <template #header>
      <PanelNavbar title="Entradas de inventario" />
    </template>

    <template #body>
      <div class="flex flex-wrap items-center gap-2">
        <TiendaFiltro />
        <div class="ms-auto">
          <UButton
            label="Nueva entrada"
            icon="i-lucide-package-plus"
            @click="abrir"
          />
        </div>
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        empty="No hay entradas en esta tienda. Registra el inventario inicial con una entrada."
        class="border border-default"
      >
        <template #id-cell="{ row }">
          <span class="carbon-data-mono">{{ row.original.id }}</span>
        </template>
        <template #createdAt-cell="{ row }">
          <span class="carbon-data-mono">{{ formatFechaHora(row.original.createdAt) }}</span>
        </template>
        <template #lineas-cell="{ row }">
          <span class="carbon-data-mono">{{ row.original.lineas }}</span>
        </template>
        <template #nota-cell="{ row }">
          <span class="text-muted">{{ row.original.nota || '—' }}</span>
        </template>
        <template #acciones-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              icon="i-lucide-eye"
              color="neutral"
              variant="ghost"
              aria-label="Ver detalle"
              @click="detalleId = row.original.id"
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

      <!-- Detalle -->
      <UModal
        v-model:open="detalleAbierto"
        :title="`Entrada #${detalleId ?? ''}`"
      >
        <template #body>
          <div
            v-if="detalleStatus === 'pending'"
            class="text-sm text-muted"
          >
            Cargando…
          </div>
          <div
            v-else-if="detalle"
            class="space-y-3"
          >
            <p class="text-sm text-muted">
              {{ detalle.tiendaNombre }} · {{ detalle.usuario }} ·
              <span class="carbon-data-mono">{{ formatFechaHora(detalle.createdAt) }}</span>
            </p>
            <p
              v-if="detalle.nota"
              class="text-sm"
            >
              {{ detalle.nota }}
            </p>
            <ul class="divide-y divide-default border border-default">
              <li
                v-for="l in detalle.lineas"
                :key="l.productoId"
                class="flex justify-between px-3 py-2 text-sm"
              >
                <span>{{ l.nombre }}</span>
                <span class="carbon-data-mono">
                  +{{ formatCantidad(l.cantidad, l.unidadMedida) }} {{ UNIDAD_ABREV[l.unidadMedida] }}
                </span>
              </li>
            </ul>
          </div>
        </template>
      </UModal>

      <!-- Nueva entrada -->
      <UModal
        v-model:open="abierto"
        title="Nueva entrada"
        :ui="{ content: 'max-w-2xl' }"
      >
        <template #body>
          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                label="Tienda"
                required
              >
                <USelect
                  v-model="tiendaEntrada"
                  :items="tiendaItems"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Nota">
                <UInput
                  v-model="nota"
                  placeholder="Opcional"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UButton
              label="Es el inventario inicial"
              icon="i-lucide-clipboard-list"
              color="neutral"
              variant="outline"
              @click="nota = 'Inventario inicial'"
            />

            <UFormField label="Agregar producto">
              <ProductoPicker
                v-model="seleccionado"
                :tienda-id="tiendaEntrada"
              />
            </UFormField>

            <SectionLabel>Líneas <span class="carbon-data-mono">({{ lineas.length }})</span></SectionLabel>
            <UEmpty
              v-if="!lineas.length"
              icon="i-lucide-package"
              title="Sin productos"
              description="Busca un producto por nombre o escanea su código."
              variant="naked"
              size="sm"
            />
            <ul
              v-else
              class="divide-y divide-default border border-default"
            >
              <li
                v-for="(l, i) in lineas"
                :key="l.producto.id"
                class="flex items-center gap-3 px-3 py-2"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ l.producto.nombre }}
                  </p>
                  <p class="carbon-data-mono text-xs text-muted">
                    Stock actual: {{ formatCantidad(l.producto.stock, l.producto.unidadMedida) }} {{ UNIDAD_ABREV[l.producto.unidadMedida] }}
                  </p>
                  <p
                    v-if="l.cantidad !== undefined && errores[i]"
                    class="text-xs text-error"
                  >
                    {{ errores[i] }}
                  </p>
                </div>
                <CantidadInput
                  v-model="l.cantidad"
                  :unidad="l.producto.unidadMedida"
                  class="w-36"
                />
                <span class="w-6 text-xs text-muted">{{ UNIDAD_ABREV[l.producto.unidadMedida] }}</span>
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  aria-label="Quitar"
                  @click="quitar(i)"
                />
              </li>
            </ul>
          </div>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="abierto = false"
            />
            <UButton
              label="Registrar entrada"
              :loading="guardando"
              :disabled="!valida"
              @click="guardar"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
