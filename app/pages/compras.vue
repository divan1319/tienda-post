<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CalendarDate } from '@internationalized/date'
import { parseDate } from '@internationalized/date'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Compras' })

const toast = useToast()
const { estado: estadoTiendas } = useTiendaActiva()
const { subir } = useComprobante()

// ---------- Filtros y listado ----------

const tiendaFiltro = ref('todas')
const tipoFiltro = ref('todas')
const desde = ref('')
const hasta = ref('')
const pagina = ref(1)
const POR_PAGINA = 50

const tiendaFiltroItems = computed(() => [
  { label: 'Todas las tiendas', value: 'todas' },
  ...estadoTiendas.value.tiendas.map(t => ({ label: t.nombre, value: String(t.id) }))
])
const tiendaItems = computed(() => estadoTiendas.value.tiendas.map(t => ({ label: t.nombre, value: t.id })))
const tipoItems = [
  { label: 'Todas', value: 'todas' },
  { label: 'Con pedido', value: 'pedido' },
  { label: 'Directas', value: 'directa' }
]

watch([tiendaFiltro, tipoFiltro, desde, hasta], () => {
  pagina.value = 1
})

const { data, status, refresh } = await useFetch('/api/compras', {
  query: computed(() => ({
    tiendaId: tiendaFiltro.value === 'todas' ? undefined : tiendaFiltro.value,
    tipo: tipoFiltro.value === 'todas' ? undefined : tipoFiltro.value,
    desde: desde.value || undefined,
    hasta: hasta.value || undefined,
    limit: POR_PAGINA,
    offset: (pagina.value - 1) * POR_PAGINA
  }))
})

type Compra = NonNullable<typeof data.value>['items'][number]

const columns: TableColumn<Compra>[] = [
  { accessorKey: 'fechaCompra', header: 'Fecha' },
  { accessorKey: 'nombre', header: 'Compra' },
  { accessorKey: 'tiendaNombre', header: 'Tienda' },
  { accessorKey: 'numeroFactura', header: 'Factura' },
  { accessorKey: 'totalCentavos', header: 'Total' },
  { accessorKey: 'turnoPagoId', header: 'Pago' },
  // Sin `header`: un string vacío provoca un desajuste de hidratación en UTable
  { id: 'acciones' }
]

function formatFecha(fecha: string) {
  const [a, m, d] = fecha.split('-')
  return `${d}/${m}/${a}`
}

// ---------- Comprobante de una compra existente ----------

const archivoInput = useTemplateRef('archivoInput')
const compraParaComprobante = ref<number | null>(null)

function elegirComprobante(id: number) {
  compraParaComprobante.value = id
  archivoInput.value?.click()
}

async function onArchivo(e: Event) {
  const input = e.target as HTMLInputElement
  const archivo = input.files?.[0]
  input.value = ''
  if (!archivo || !compraParaComprobante.value) return
  if (await subir(compraParaComprobante.value, archivo)) {
    toast.add({ title: 'Comprobante guardado', color: 'success' })
    await refresh()
  }
}

// ---------- Compra directa ----------

const abierto = ref(false)
const guardando = ref(false)
const form = reactive({
  tiendaId: undefined as number | undefined,
  nombre: '',
  proveedor: '',
  total: undefined as number | undefined,
  numeroFactura: '',
  comprobante: null as File | null,
  pagarConCaja: false,
  turnoId: undefined as number | undefined
})
// Fuera de reactive(): reactive() pierde el tipo de CalendarDate (campos privados)
const fechaCompra = shallowRef<CalendarDate>()

function abrir() {
  Object.assign(form, {
    tiendaId: estadoTiendas.value.tiendaActivaId ?? undefined,
    nombre: '',
    proveedor: '',
    total: undefined,
    numeroFactura: '',
    comprobante: null,
    pagarConCaja: false,
    turnoId: undefined
  })
  fechaCompra.value = parseDate(hoyLocal())
  abierto.value = true
}

const valido = computed(() =>
  !!form.tiendaId && form.nombre.trim().length > 0 && form.total !== undefined && form.total > 0
  && !!fechaCompra.value && (!form.pagarConCaja || !!form.turnoId)
)

async function guardar() {
  if (!valido.value) return
  guardando.value = true
  try {
    const res = await $fetch('/api/compras', {
      method: 'POST',
      body: {
        tiendaId: form.tiendaId,
        nombre: form.nombre,
        proveedor: form.proveedor || null,
        totalCentavos: dolaresACentavos(form.total!),
        numeroFactura: form.numeroFactura || null,
        fechaCompra: fechaCompra.value!.toString(),
        turnoId: form.pagarConCaja ? form.turnoId : null
      }
    })
    if (form.comprobante) await subir(res.compra.id, form.comprobante)
    toast.add({ title: 'Compra registrada', color: 'success' })
    abierto.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo registrar la compra'), color: 'error' })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="compras">
    <template #header>
      <PanelNavbar title="Compras" />
    </template>

    <template #body>
      <div class="flex flex-wrap items-end gap-2">
        <UFormField
          label="Tienda"
          class="min-w-0 grow basis-36 sm:grow-0 sm:basis-auto"
        >
          <USelect
            v-model="tiendaFiltro"
            :items="tiendaFiltroItems"
            class="w-full sm:w-52"
          />
        </UFormField>
        <UFormField
          label="Tipo"
          class="min-w-0 grow basis-36 sm:grow-0 sm:basis-auto"
        >
          <USelect
            v-model="tipoFiltro"
            :items="tipoItems"
            class="w-full sm:w-40"
          />
        </UFormField>
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
        <div class="flex w-full gap-2 sm:ms-auto sm:w-auto">
          <UButton
            :to="urlExportacion('/api/compras/exportar', {
              tiendaId: tiendaFiltro === 'todas' ? undefined : tiendaFiltro,
              tipo: tipoFiltro === 'todas' ? undefined : tipoFiltro,
              desde,
              hasta
            })"
            external
            download
            label="Exportar CSV"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            class="grow justify-center sm:grow-0"
          />
          <UButton
            label="Compra directa"
            icon="i-lucide-plus"
            class="grow justify-center sm:grow-0"
            @click="abrir"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <UCard variant="outline">
          <SectionLabel>Total comprado</SectionLabel>
          <p class="carbon-data-mono mt-2 text-xl font-semibold text-highlighted wrap-anywhere sm:text-2xl">
            {{ formatUSD(data?.resumen.totalCentavos ?? 0) }}
          </p>
          <p class="carbon-data-mono text-sm text-muted">
            {{ data?.resumen.compras ?? 0 }} compra(s)
          </p>
        </UCard>
        <UCard variant="outline">
          <SectionLabel>Con pedido</SectionLabel>
          <p class="carbon-data-mono mt-2 text-xl font-semibold wrap-anywhere sm:text-2xl">
            {{ formatUSD(data?.resumen.conPedidoCentavos ?? 0) }}
          </p>
        </UCard>
        <UCard variant="outline">
          <SectionLabel>Directas</SectionLabel>
          <p class="carbon-data-mono mt-2 text-xl font-semibold wrap-anywhere sm:text-2xl">
            {{ formatUSD(data?.resumen.directasCentavos ?? 0) }}
          </p>
        </UCard>
        <UCard variant="outline">
          <SectionLabel>Pagado con caja</SectionLabel>
          <p class="carbon-data-mono mt-2 text-xl font-semibold wrap-anywhere sm:text-2xl">
            {{ formatUSD(data?.resumen.pagadoConCajaCentavos ?? 0) }}
          </p>
        </UCard>
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :column-pinning="ACCIONES_FIJAS"
        :loading="status === 'pending'"
        empty="No hay compras en el periodo."
        class="border border-default"
      >
        <template #fechaCompra-cell="{ row }">
          <span class="carbon-data-mono">{{ formatFecha(row.original.fechaCompra) }}</span>
        </template>
        <template #nombre-cell="{ row }">
          <div>
            <p class="font-medium text-highlighted">
              {{ row.original.nombre }}
            </p>
            <p class="text-xs text-muted">
              <UBadge
                :label="row.original.tipo === 'pedido' ? 'Con pedido' : 'Directa'"
                :color="row.original.tipo === 'pedido' ? 'primary' : 'neutral'"
                variant="subtle"
                size="sm"
              />
              <span
                v-if="row.original.proveedor"
                class="ms-1"
              >{{ row.original.proveedor }}</span>
            </p>
          </div>
        </template>
        <template #numeroFactura-cell="{ row }">
          <span class="carbon-data-mono text-muted">{{ row.original.numeroFactura || '—' }}</span>
        </template>
        <template #totalCentavos-cell="{ row }">
          <span class="carbon-data-mono">{{ formatUSD(row.original.totalCentavos) }}</span>
        </template>
        <template #turnoPagoId-cell="{ row }">
          <UBadge
            v-if="row.original.turnoPagoId"
            :label="`Caja · turno #${row.original.turnoPagoId}`"
            color="warning"
            variant="subtle"
          />
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #acciones-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              v-if="row.original.comprobanteKey"
              :to="`/api/files/${row.original.comprobanteKey}`"
              target="_blank"
              external
              icon="i-lucide-file-text"
              color="neutral"
              variant="ghost"
              aria-label="Ver comprobante"
            />
            <UButton
              :icon="row.original.comprobanteKey ? 'i-lucide-file-up' : 'i-lucide-upload'"
              color="neutral"
              variant="ghost"
              :aria-label="row.original.comprobanteKey ? 'Reemplazar comprobante' : 'Subir comprobante'"
              @click="elegirComprobante(row.original.id)"
            />
          </div>
        </template>
      </UTable>

      <input
        ref="archivoInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        class="hidden"
        @change="onArchivo"
      >

      <PaginacionListado
        v-if="(data?.total ?? 0) > POR_PAGINA"
        v-model:page="pagina"
        :total="data?.total ?? 0"
        :items-per-page="POR_PAGINA"
      />

      <!-- Compra directa -->
      <UModal
        v-model:open="abierto"
        title="Compra directa"
        description="Sin pedido previo (por ejemplo, llegó un vendedor)."
      >
        <template #body>
          <form
            id="form-compra"
            class="space-y-4"
            @submit.prevent="guardar"
          >
            <UFormField
              label="Tienda"
              required
            >
              <USelect
                v-model="form.tiendaId"
                :items="tiendaItems"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Qué se compró"
              required
            >
              <UInput
                v-model="form.nombre"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Proveedor">
              <UInput
                v-model="form.proveedor"
                placeholder="Opcional"
                class="w-full"
              />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                label="Total"
                required
              >
                <UInputNumber
                  v-model="form.total"
                  :min="0"
                  :step="0.01"
                  :format-options="{ style: 'currency', currency: 'USD' }"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Fecha"
                required
              >
                <UInputDate
                  v-model="fechaCompra"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField label="Número de factura o comprobante">
              <UInput
                v-model="form.numeroFactura"
                placeholder="Opcional"
                class="carbon-data-mono w-full"
              />
            </UFormField>
            <UFormField
              label="Comprobante"
              help="Foto o PDF, máximo 10 MB. Opcional."
            >
              <UFileUpload
                v-model="form.comprobante"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                label="Arrastra el comprobante o haz clic"
                layout="list"
                class="w-full"
              />
            </UFormField>
            <PagoCajaSelector
              v-model:pagar="form.pagarConCaja"
              v-model:turno-id="form.turnoId"
              :tienda-id="form.tiendaId"
              :total-centavos="form.total !== undefined ? dolaresACentavos(form.total) : undefined"
            />
          </form>
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
              type="submit"
              form="form-compra"
              label="Registrar compra"
              :loading="guardando"
              :disabled="!valido"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
