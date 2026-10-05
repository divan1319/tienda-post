<script setup lang="ts">
import type { TableColumn, TabsItem } from '@nuxt/ui'
import type { CalendarDate } from '@internationalized/date'
import { parseDate } from '@internationalized/date'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Pedidos' })

const toast = useToast()
const { estado: estadoTiendas } = useTiendaActiva()
const { subir } = useComprobante()

type Estado = 'pendiente' | 'recibido' | 'cancelado'

// ---------- Listado ----------

const pestana = ref<Estado>('pendiente')
const tabs: TabsItem[] = [
  { label: 'Pendientes', value: 'pendiente', icon: 'i-lucide-clock' },
  { label: 'Recibidos', value: 'recibido', icon: 'i-lucide-package-check' },
  { label: 'Cancelados', value: 'cancelado', icon: 'i-lucide-x-circle' }
]

const tiendaFiltro = ref('todas')
const tiendaFiltroItems = computed(() => [
  { label: 'Todas las tiendas', value: 'todas' },
  ...estadoTiendas.value.tiendas.map(t => ({ label: t.nombre, value: String(t.id) }))
])
const tiendaItems = computed(() => estadoTiendas.value.tiendas.map(t => ({ label: t.nombre, value: t.id })))

const POR_PAGINA = 50
const pagina = ref(1)
watch([pestana, tiendaFiltro], () => {
  pagina.value = 1
})

const { data, status, refresh } = await useFetch('/api/pedidos', {
  query: computed(() => ({
    estado: pestana.value,
    tiendaId: tiendaFiltro.value === 'todas' ? undefined : tiendaFiltro.value,
    limit: POR_PAGINA,
    offset: (pagina.value - 1) * POR_PAGINA
  }))
})

type Pedido = NonNullable<typeof data.value>['items'][number]

const columns = computed<TableColumn<Pedido>[]>(() => [
  { accessorKey: 'fechaEsperada', header: 'Fecha esperada' },
  { accessorKey: 'nombre', header: 'Pedido' },
  { accessorKey: 'proveedor', header: 'Proveedor' },
  { accessorKey: 'tiendaNombre', header: 'Tienda' },
  ...(pestana.value === 'recibido' ? [{ accessorKey: 'compraTotalCentavos', header: 'Total pagado' }] as TableColumn<Pedido>[] : []),
  { accessorKey: 'nota', header: 'Nota' },
  // Sin `header`: un string vacío provoca un desajuste de hidratación en UTable
  { id: 'acciones' }
])

const SITUACION: Record<'atrasado' | 'hoy' | 'proximo', { label: string, color: 'error' | 'warning' | 'neutral' }> = {
  atrasado: { label: 'Atrasado', color: 'error' },
  hoy: { label: 'Hoy', color: 'warning' },
  proximo: { label: 'Próximo', color: 'neutral' }
}

function formatFecha(fecha: string) {
  const [a, m, d] = fecha.split('-')
  return `${d}/${m}/${a}`
}

// ---------- Crear / editar ----------

const abierto = ref(false)
const editando = ref<Pedido | null>(null)
const guardando = ref(false)
const form = reactive({
  tiendaId: undefined as number | undefined,
  nombre: '',
  proveedor: '',
  nota: ''
})
// Fuera de reactive(): reactive() pierde el tipo de CalendarDate (campos privados)
const fechaEsperada = shallowRef<CalendarDate>()

function abrir(p?: Pedido) {
  editando.value = p ?? null
  Object.assign(form, {
    tiendaId: p?.tiendaId ?? estadoTiendas.value.tiendaActivaId ?? undefined,
    nombre: p?.nombre ?? '',
    proveedor: p?.proveedor ?? '',
    nota: p?.nota ?? ''
  })
  fechaEsperada.value = p ? parseDate(p.fechaEsperada) : parseDate(hoyLocal())
  abierto.value = true
}

const formValido = computed(() => !!form.tiendaId && form.nombre.trim().length > 0 && !!fechaEsperada.value)

async function guardar() {
  if (!formValido.value) return
  guardando.value = true
  const body = {
    tiendaId: form.tiendaId,
    nombre: form.nombre,
    proveedor: form.proveedor || null,
    fechaEsperada: fechaEsperada.value!.toString(),
    nota: form.nota || null
  }
  try {
    if (editando.value) {
      await $fetch(`/api/pedidos/${editando.value.id}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/pedidos', { method: 'POST', body })
    }
    toast.add({ title: editando.value ? 'Pedido actualizado' : 'Pedido creado', color: 'success' })
    abierto.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo guardar el pedido'), color: 'error' })
  } finally {
    guardando.value = false
  }
}

// ---------- Cancelar ----------

const cancelando = ref<Pedido | null>(null)
async function cancelar() {
  if (!cancelando.value) return
  try {
    await $fetch(`/api/pedidos/${cancelando.value.id}/cancelar`, { method: 'POST' })
    toast.add({ title: 'Pedido cancelado', color: 'success' })
    cancelando.value = null
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo cancelar el pedido'), color: 'error' })
  }
}

// ---------- Recibir ----------

const recibiendo = ref<Pedido | null>(null)
const recibido = ref<{ pedido: Pedido } | null>(null)
const enviando = ref(false)
const rec = reactive({
  total: undefined as number | undefined,
  numeroFactura: '',
  comprobante: null as File | null,
  pagarConCaja: false,
  turnoId: undefined as number | undefined
})
const fechaCompra = shallowRef<CalendarDate>()

function abrirRecibir(p: Pedido) {
  Object.assign(rec, {
    total: undefined,
    numeroFactura: '',
    comprobante: null,
    pagarConCaja: false,
    turnoId: undefined
  })
  fechaCompra.value = parseDate(hoyLocal())
  recibiendo.value = p
}

const recValido = computed(() =>
  rec.total !== undefined && rec.total > 0 && !!fechaCompra.value && (!rec.pagarConCaja || !!rec.turnoId)
)

async function confirmarRecibir() {
  const p = recibiendo.value
  if (!p || !recValido.value) return
  enviando.value = true
  try {
    const res = await $fetch(`/api/pedidos/${p.id}/recibir`, {
      method: 'POST',
      body: {
        totalCentavos: dolaresACentavos(rec.total!),
        numeroFactura: rec.numeroFactura || null,
        fechaCompra: fechaCompra.value!.toString(),
        turnoId: rec.pagarConCaja ? rec.turnoId : null
      }
    })
    if (rec.comprobante) await subir(res.compra.id, rec.comprobante)
    recibiendo.value = null
    recibido.value = { pedido: p }
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo recibir el pedido'), color: 'error' })
  } finally {
    enviando.value = false
  }
}

// Atajo: registrar la entrada de inventario de lo recibido (sin vincular registros)
async function registrarEntrada() {
  const p = recibido.value?.pedido
  recibido.value = null
  if (!p) return
  await navigateTo({ path: '/inventario/entradas', query: { nueva: '1', tiendaId: String(p.tiendaId), nota: `Pedido: ${p.nombre}` } })
}
</script>

<template>
  <UDashboardPanel id="pedidos">
    <template #header>
      <PanelNavbar title="Pedidos" />
    </template>

    <template #body>
      <div class="flex flex-wrap items-center gap-2">
        <UTabs
          v-model="pestana"
          :items="tabs"
          :content="false"
          class="w-full sm:w-auto"
          :ui="{ leadingIcon: 'hidden sm:inline-flex' }"
        />
        <USelect
          v-model="tiendaFiltro"
          :items="tiendaFiltroItems"
          class="min-w-0 flex-1 sm:w-52 sm:flex-none"
        />
        <div class="sm:ms-auto">
          <UButton
            label="Nuevo pedido"
            icon="i-lucide-plus"
            @click="abrir()"
          />
        </div>
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :column-pinning="ACCIONES_FIJAS"
        :loading="status === 'pending'"
        empty="No hay pedidos."
        class="border border-default"
      >
        <template #fechaEsperada-cell="{ row }">
          <div class="flex items-center gap-2">
            <span class="carbon-data-mono">{{ formatFecha(row.original.fechaEsperada) }}</span>
            <UBadge
              v-if="row.original.situacion"
              :label="SITUACION[row.original.situacion].label"
              :color="SITUACION[row.original.situacion].color"
              variant="subtle"
            />
          </div>
        </template>
        <template #nombre-cell="{ row }">
          <span class="block min-w-32 whitespace-normal">{{ row.original.nombre }}</span>
        </template>
        <template #proveedor-cell="{ row }">
          <span class="text-muted">{{ row.original.proveedor || '—' }}</span>
        </template>
        <template #compraTotalCentavos-cell="{ row }">
          <span class="carbon-data-mono">{{ row.original.compraTotalCentavos !== null ? formatUSD(row.original.compraTotalCentavos) : '—' }}</span>
        </template>
        <template #nota-cell="{ row }">
          <span class="block min-w-32 whitespace-normal text-muted">{{ row.original.nota || '—' }}</span>
        </template>
        <template #acciones-cell="{ row }">
          <div
            v-if="row.original.estado === 'pendiente'"
            class="flex justify-end gap-1"
          >
            <UButton
              label="Recibir"
              aria-label="Recibir"
              icon="i-lucide-package-check"
              size="xs"
              :ui="{ label: 'hidden sm:inline' }"
              @click="abrirRecibir(row.original)"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              aria-label="Editar"
              @click="abrir(row.original)"
            />
            <UButton
              icon="i-lucide-x"
              color="error"
              variant="ghost"
              aria-label="Cancelar pedido"
              @click="cancelando = row.original"
            />
          </div>
        </template>
      </UTable>

      <PaginacionListado
        v-if="(data?.total ?? 0) > POR_PAGINA"
        v-model:page="pagina"
        :total="data?.total ?? 0"
        :items-per-page="POR_PAGINA"
      />

      <!-- Crear / editar -->
      <UModal
        v-model:open="abierto"
        :title="editando ? 'Editar pedido' : 'Nuevo pedido'"
      >
        <template #body>
          <form
            id="form-pedido"
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
              label="Nombre"
              required
              help="Por ejemplo: bebidas de la distribuidora."
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
            <UFormField
              label="Fecha esperada"
              required
            >
              <UInputDate
                v-model="fechaEsperada"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Nota">
              <UTextarea
                v-model="form.nota"
                :rows="2"
                placeholder="Opcional"
                class="w-full"
              />
            </UFormField>
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
              form="form-pedido"
              label="Guardar"
              :loading="guardando"
              :disabled="!formValido"
            />
          </div>
        </template>
      </UModal>

      <!-- Recibir -->
      <UModal
        :open="!!recibiendo"
        title="Recibir pedido"
        :description="recibiendo ? `${recibiendo.nombre} · ${recibiendo.tiendaNombre}` : undefined"
        @update:open="(v) => { if (!v) recibiendo = null }"
      >
        <template #body>
          <form
            id="form-recibir"
            class="space-y-4"
            @submit.prevent="confirmarRecibir"
          >
            <p class="text-sm text-muted">
              Si llegó incompleto, registra solo lo que se pagó.
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                label="Total pagado"
                required
              >
                <UInputNumber
                  v-model="rec.total"
                  :min="0"
                  :step="0.01"
                  :format-options="{ style: 'currency', currency: 'USD' }"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Fecha de la compra"
                required
              >
                <UInputDate
                  v-model="fechaCompra"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField label="Número de factura">
              <UInput
                v-model="rec.numeroFactura"
                placeholder="Opcional"
                class="carbon-data-mono w-full"
              />
            </UFormField>
            <UFormField
              label="Comprobante"
              help="Foto o PDF, máximo 10 MB. Opcional."
            >
              <UFileUpload
                v-model="rec.comprobante"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                label="Arrastra el comprobante o haz clic"
                layout="list"
                class="w-full"
              />
            </UFormField>
            <PagoCajaSelector
              v-if="recibiendo"
              v-model:pagar="rec.pagarConCaja"
              v-model:turno-id="rec.turnoId"
              :tienda-id="recibiendo.tiendaId"
              :total-centavos="rec.total !== undefined ? dolaresACentavos(rec.total) : undefined"
            />
          </form>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="recibiendo = null"
            />
            <UButton
              type="submit"
              form="form-recibir"
              label="Registrar compra"
              :loading="enviando"
              :disabled="!recValido"
            />
          </div>
        </template>
      </UModal>

      <!-- Recibido: atajo a la entrada de inventario -->
      <UModal
        :open="!!recibido"
        title="Pedido recibido"
        description="La compra quedó registrada. ¿Quieres registrar ahora la entrada de inventario de lo que llegó?"
        @update:open="(v) => { if (!v) recibido = null }"
      >
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              label="Ahora no"
              color="neutral"
              variant="outline"
              @click="recibido = null"
            />
            <UButton
              label="Registrar entrada"
              icon="i-lucide-package-plus"
              @click="registrarEntrada"
            />
          </div>
        </template>
      </UModal>

      <!-- Cancelar -->
      <UModal
        :open="!!cancelando"
        title="¿Cancelar el pedido?"
        :description="cancelando ? `${cancelando.nombre}: pasará a cancelado sin generar compra.` : undefined"
        @update:open="(v) => { if (!v) cancelando = null }"
      >
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              label="Volver"
              color="neutral"
              variant="outline"
              @click="cancelando = null"
            />
            <UButton
              label="Cancelar pedido"
              color="error"
              @click="cancelar"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
