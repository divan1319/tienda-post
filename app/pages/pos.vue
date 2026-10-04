<script setup lang="ts">
import type { VentaTicket } from '#shared/types/ventas'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ layout: 'pos' })

useSeoMeta({ title: 'Punto de venta' })

const toast = useToast()
const { estado } = useTiendaActiva()

// ---------- Turno de caja ----------

const { data: turnoData, refresh: refreshTurno } = await useFetch('/api/caja/turno-actual')
const turno = computed(() => turnoData.value?.turno ?? null)
const necesitaTurno = computed(() => !!turnoData.value && !turno.value)

const montoInicial = ref<number | undefined>()
const abriendoTurno = ref(false)

async function abrirTurno() {
  if (montoInicial.value === undefined || montoInicial.value < 0) return
  abriendoTurno.value = true
  try {
    await $fetch('/api/caja/turnos', {
      method: 'POST',
      body: { montoInicialCentavos: dolaresACentavos(montoInicial.value) }
    })
    toast.add({ title: 'Turno abierto', color: 'success' })
    montoInicial.value = undefined
    await refreshTurno()
    enfocarBusqueda()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo abrir el turno'), color: 'error' })
  } finally {
    abriendoTurno.value = false
  }
}

// ---------- Productos ----------

const { data: productosData, refresh: refreshProductos, status: productosStatus } = await useFetch('/api/productos', {
  query: { limit: 1000 }
})

type Producto = NonNullable<typeof productosData.value>['items'][number]
const productos = computed(() => productosData.value?.items ?? [])

const busqueda = ref('')
const categoria = ref<string>('todas')
const busquedaRef = useTemplateRef('busquedaRef')

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const categorias = computed(() => {
  const vistas = new Map<string, string>()
  for (const p of productos.value) {
    vistas.set(p.categoriaId ? String(p.categoriaId) : 'sin', p.categoriaNombre ?? 'Sin categoría')
  }
  return [...vistas].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
})

const filtrados = computed(() => {
  const q = normalizar(busqueda.value.trim())
  return productos.value.filter((p) => {
    const cat = p.categoriaId ? String(p.categoriaId) : 'sin'
    if (categoria.value !== 'todas' && cat !== categoria.value) return false
    if (!q) return true
    return normalizar(p.nombre).includes(q) || (p.codigoBarras ?? '').includes(q)
  })
})

function enfocarBusqueda() {
  nextTick(() => busquedaRef.value?.inputRef?.focus())
}

// Un lector USB escribe el código como teclado y termina con Enter
function onBuscarEnter() {
  const codigo = busqueda.value.trim()
  if (!codigo) return
  const exacto = productos.value.find(p => p.codigoBarras === codigo)
  const unico = filtrados.value.length === 1 ? filtrados.value[0] : undefined
  const producto = exacto ?? unico
  if (producto) {
    agregar(producto)
    busqueda.value = ''
  } else {
    toast.add({ title: `Sin coincidencia exacta para «${codigo}»`, color: 'warning' })
  }
}

// ---------- Carrito ----------

interface LineaCarrito {
  productoId: number
  nombre: string
  unidadMedida: UnidadMedida
  precioUnitarioCentavos: number
  cantidad: number | undefined
  stock: number
}

const carrito = useState<LineaCarrito[]>('pos-carrito', () => [])
const carritoTienda = useState<number | null>('pos-carrito-tienda', () => null)

// El carrito pertenece a una tienda: si cambia la tienda activa, se vacía
watch(() => estado.value.tiendaActivaId, (id) => {
  if (carritoTienda.value !== id) {
    carrito.value = []
    carritoTienda.value = id
  }
}, { immediate: true })

// Mantiene el stock mostrado en el carrito al día tras recargar productos
watch(productos, (lista) => {
  for (const l of carrito.value) {
    const p = lista.find(x => x.id === l.productoId)
    if (p) l.stock = p.stock
  }
})

const granel = ref<Producto | null>(null)
const cantidadGranel = ref<number | undefined>()
const errorGranel = computed(() =>
  granel.value && cantidadGranel.value !== undefined
    ? validarCantidad(cantidadGranel.value, granel.value.unidadMedida)
    : null
)

function sumarAlCarrito(p: Producto, cantidad: number) {
  const linea = carrito.value.find(l => l.productoId === p.id)
  if (linea) {
    linea.cantidad = deMilesimas(aMilesimas(linea.cantidad ?? 0) + aMilesimas(cantidad))
  } else {
    carrito.value.push({
      productoId: p.id,
      nombre: p.nombre,
      unidadMedida: p.unidadMedida,
      precioUnitarioCentavos: p.precioVentaCentavos,
      cantidad,
      stock: p.stock
    })
  }
}

function agregar(p: Producto) {
  if (!turno.value) return
  // Por libra o litro se pide la cantidad
  if (p.unidadMedida !== 'unidad') {
    granel.value = p
    cantidadGranel.value = undefined
    return
  }
  sumarAlCarrito(p, 1)
  enfocarBusqueda()
}

function confirmarGranel() {
  if (!granel.value || cantidadGranel.value === undefined || errorGranel.value) return
  sumarAlCarrito(granel.value, cantidadGranel.value)
  granel.value = null
  enfocarBusqueda()
}

function quitar(i: number) {
  carrito.value.splice(i, 1)
}

// En pantallas pequeñas el carrito va plegado bajo los productos: se ve el total
// y el botón de cobrar, y la lista se despliega a pedido. En lg+ siempre se ve.
const carritoAbierto = ref(false)
watch(() => carrito.value.length, (n) => {
  if (!n) carritoAbierto.value = false
})

function vaciar() {
  carrito.value = []
  enfocarBusqueda()
}

const errores = computed(() => carrito.value.map(l =>
  l.cantidad === undefined ? 'Falta la cantidad' : validarCantidad(l.cantidad, l.unidadMedida)
))
const subtotales = computed(() => carrito.value.map((l, i) =>
  l.cantidad !== undefined && !errores.value[i] ? subtotalLinea(l.precioUnitarioCentavos, l.cantidad) : 0
))
const total = computed(() => totalVenta(subtotales.value))

function excedeStock(l: LineaCarrito) {
  return l.cantidad !== undefined && aMilesimas(l.cantidad) > aMilesimas(l.stock)
}
const lineasSinStock = computed(() => carrito.value.filter(excedeStock))

const puedeCobrar = computed(() =>
  !!turno.value && carrito.value.length > 0 && errores.value.every(e => !e)
)

// ---------- Cobro ----------

const modalCobro = ref(false)
const metodo = ref<MetodoPago>('efectivo')
const recibido = ref<number | undefined>()
const cobrando = ref(false)

const metodoItems = METODOS_PAGO.map(m => ({ label: METODO_PAGO_LABEL[m], value: m }))

const cobro = computed(() => calcularCobro(
  total.value,
  metodo.value,
  recibido.value !== undefined ? dolaresACentavos(recibido.value) : undefined
))

function abrirCobro() {
  if (!puedeCobrar.value || modalCobro.value) return
  metodo.value = 'efectivo'
  recibido.value = undefined
  modalCobro.value = true
}

function montoExacto() {
  recibido.value = centavosADolares(total.value)
}

const ventaHecha = ref<VentaTicket | null>(null)
const modalTicket = ref(false)

async function confirmarVenta() {
  if (cobrando.value || 'error' in cobro.value) return
  cobrando.value = true
  try {
    const venta = await $fetch<VentaTicket>('/api/ventas', {
      method: 'POST',
      body: {
        lineas: carrito.value.map(l => ({ productoId: l.productoId, cantidad: l.cantidad! })),
        metodoPago: metodo.value,
        montoRecibidoCentavos: metodo.value === 'efectivo' ? cobro.value.montoRecibidoCentavos : null
      }
    })
    ventaHecha.value = venta
    modalCobro.value = false
    modalTicket.value = true
    carrito.value = []
    await refreshProductos()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo registrar la venta'), color: 'error' })
    const codigo = (err as { data?: { data?: { code?: string } } }).data?.data?.code
    if (codigo === 'SIN_TURNO') {
      modalCobro.value = false
      await refreshTurno()
    }
  } finally {
    cobrando.value = false
  }
}

function nuevaVenta() {
  modalTicket.value = false
  enfocarBusqueda()
}

function imprimir() {
  window.print()
}

defineShortcuts({
  f2: { usingInput: true, handler: abrirCobro }
})

onMounted(enfocarBusqueda)
</script>

<template>
  <div class="flex h-full flex-col lg:flex-row">
    <!-- Productos -->
    <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4 pb-2 lg:pb-4">
      <UInput
        ref="busquedaRef"
        v-model="busqueda"
        icon="i-lucide-scan-barcode"
        size="lg"
        placeholder="Buscar por nombre o escanear código"
        :disabled="!turno"
        class="w-full"
        @keydown.enter.prevent="onBuscarEnter"
      >
        <template #trailing>
          <UKbd
            value="Enter"
            class="hidden lg:inline-flex"
          />
        </template>
      </UInput>

      <div class="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
        <UButton
          label="Todas"
          size="xs"
          class="shrink-0"
          :variant="categoria === 'todas' ? 'solid' : 'outline'"
          :color="categoria === 'todas' ? 'primary' : 'neutral'"
          @click="categoria = 'todas'"
        />
        <UButton
          v-for="c in categorias"
          :key="c.value"
          :label="c.label"
          size="xs"
          class="shrink-0"
          :variant="categoria === c.value ? 'solid' : 'outline'"
          :color="categoria === c.value ? 'primary' : 'neutral'"
          @click="categoria = c.value"
        />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <UEmpty
          v-if="productosStatus !== 'pending' && !filtrados.length"
          icon="i-lucide-package-search"
          title="Sin productos"
          :description="productos.length ? 'Nada coincide con la búsqueda.' : 'Aún no hay productos activos.'"
        />
        <div class="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-5 xl:grid-cols-4">
          <button
            v-for="p in filtrados"
            :key="p.id"
            type="button"
            class="flex flex-col gap-1 rounded-xs border border-default p-3 text-left transition-colors hover:border-primary hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!turno"
            @click="agregar(p)"
          >
            <span class="line-clamp-2 text-sm font-medium text-highlighted">{{ p.nombre }}</span>
            <span class="carbon-data-mono text-sm">
              {{ formatUSD(p.precioVentaCentavos) }}<span class="text-xs text-muted"> / {{ UNIDAD_ABREV[p.unidadMedida] }}</span>
            </span>
            <span
              class="carbon-data-mono text-xs"
              :class="p.stock <= 0 ? 'text-error' : 'text-muted'"
            >
              Stock: {{ formatCantidad(p.stock, p.unidadMedida) }}
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- Carrito -->
    <aside class="flex max-h-[60dvh] shrink-0 flex-col border-t border-default lg:max-h-none lg:w-104 lg:border-s lg:border-t-0">
      <div class="flex min-h-10 items-center justify-between px-4 pt-2 lg:pt-4">
        <SectionLabel class="hidden lg:block">
          Carrito <span class="carbon-data-mono">({{ carrito.length }})</span>
        </SectionLabel>
        <button
          type="button"
          data-carrito-toggle
          class="flex items-center gap-2 py-1 lg:hidden"
          :aria-expanded="carritoAbierto"
          aria-controls="pos-carrito-lista"
          @click="carritoAbierto = !carritoAbierto"
        >
          <SectionLabel>Carrito <span class="carbon-data-mono">({{ carrito.length }})</span></SectionLabel>
          <UIcon
            v-if="!carritoAbierto && (errores.some(e => e) || lineasSinStock.length)"
            name="i-lucide-triangle-alert"
            class="size-4 text-warning"
          />
          <UIcon
            :name="carritoAbierto ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
            class="size-4 text-muted"
          />
        </button>
        <UButton
          v-if="carrito.length"
          label="Vaciar"
          icon="i-lucide-trash-2"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="vaciar"
        />
      </div>

      <div
        id="pos-carrito-lista"
        class="min-h-0 flex-1 overflow-y-auto px-4 py-2"
        :class="{ 'hidden lg:block': !carritoAbierto }"
      >
        <UEmpty
          v-if="!carrito.length"
          icon="i-lucide-shopping-cart"
          title="Carrito vacío"
          description="Escanea o toca un producto para agregarlo."
          variant="naked"
          size="sm"
        />
        <ul
          v-else
          class="divide-y divide-default border border-default"
        >
          <li
            v-for="(l, i) in carrito"
            :key="l.productoId"
            class="space-y-1 px-3 py-2"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-sm font-medium">{{ l.nombre }}</span>
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Quitar"
                @click="quitar(i)"
              />
            </div>
            <div class="flex items-center gap-2">
              <CantidadInput
                v-model="l.cantidad"
                :unidad="l.unidadMedida"
                class="w-32"
              />
              <span class="carbon-data-mono text-xs text-muted">
                {{ UNIDAD_ABREV[l.unidadMedida] }} × {{ formatUSD(l.precioUnitarioCentavos) }}
              </span>
              <span class="carbon-data-mono ms-auto text-sm">{{ formatUSD(subtotales[i] ?? 0) }}</span>
            </div>
            <p
              v-if="l.cantidad !== undefined && errores[i]"
              class="text-xs text-error"
            >
              {{ errores[i] }}
            </p>
            <p
              v-else-if="excedeStock(l)"
              class="flex items-center gap-1 text-xs text-warning"
            >
              <UIcon name="i-lucide-triangle-alert" />
              Supera el stock registrado ({{ formatCantidad(l.stock, l.unidadMedida) }} {{ UNIDAD_ABREV[l.unidadMedida] }})
            </p>
          </li>
        </ul>
      </div>

      <!-- En móvil, total y botón en una sola fila para dejar más espacio a los productos -->
      <div
        class="flex items-center gap-3 p-4 lg:block lg:space-y-3 lg:border-t lg:border-default lg:pt-4"
        :class="carritoAbierto ? 'border-t border-default pt-3' : 'pt-2'"
      >
        <div class="flex shrink-0 flex-col lg:flex-row lg:items-baseline lg:justify-between">
          <SectionLabel>Total</SectionLabel>
          <span class="carbon-data-mono text-2xl font-semibold text-highlighted lg:text-3xl">{{ formatUSD(total) }}</span>
        </div>
        <UButton
          size="xl"
          block
          icon="i-lucide-banknote"
          class="min-w-0 flex-1"
          :disabled="!puedeCobrar"
          @click="abrirCobro"
        >
          Cobrar
          <UKbd
            value="F2"
            class="ms-2 hidden lg:inline-flex"
          />
        </UButton>
      </div>
    </aside>

    <!-- Abrir turno -->
    <UModal
      :open="necesitaTurno"
      title="Abrir turno de caja"
      description="Para vender necesitas un turno abierto en esta tienda."
      :dismissible="false"
      :close="false"
    >
      <template #body>
        <form
          id="form-turno"
          @submit.prevent="abrirTurno"
        >
          <UFormField
            label="Efectivo inicial en caja"
            required
          >
            <UInputNumber
              v-model="montoInicial"
              :min="0"
              :step="0.01"
              :format-options="{ style: 'currency', currency: 'USD' }"
              autofocus
              class="w-full"
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton
            to="/"
            label="Volver al panel"
            color="neutral"
            variant="outline"
          />
          <UButton
            type="submit"
            form="form-turno"
            label="Abrir turno"
            :loading="abriendoTurno"
            :disabled="montoInicial === undefined"
          />
        </div>
      </template>
    </UModal>

    <!-- Cantidad para productos por libra o litro -->
    <UModal
      :open="!!granel"
      :title="granel?.nombre"
      :description="granel ? `Precio: ${formatUSD(granel.precioVentaCentavos)} por ${UNIDAD_LABEL[granel.unidadMedida].toLowerCase()}` : undefined"
      @update:open="(v) => { if (!v) granel = null }"
    >
      <template #body>
        <form
          v-if="granel"
          id="form-granel"
          @submit.prevent="confirmarGranel"
        >
          <UFormField
            :label="`Cantidad (${UNIDAD_ABREV[granel.unidadMedida]})`"
            :error="errorGranel ?? undefined"
          >
            <CantidadInput
              v-model="cantidadGranel"
              :unidad="granel.unidadMedida"
              autofocus
              class="w-full"
            />
          </UFormField>
          <p
            v-if="cantidadGranel !== undefined && !errorGranel"
            class="carbon-data-mono mt-2 text-sm text-muted"
          >
            Subtotal: {{ formatUSD(subtotalLinea(granel.precioVentaCentavos, cantidadGranel)) }}
          </p>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="granel = null"
          />
          <UButton
            type="submit"
            form="form-granel"
            label="Agregar"
            :disabled="cantidadGranel === undefined || !!errorGranel"
          />
        </div>
      </template>
    </UModal>

    <!-- Cobro -->
    <UModal
      v-model:open="modalCobro"
      title="Cobrar"
    >
      <template #body>
        <form
          id="form-cobro"
          class="space-y-4"
          @submit.prevent="confirmarVenta"
        >
          <div class="flex items-baseline justify-between">
            <SectionLabel>Total a cobrar</SectionLabel>
            <span class="carbon-data-mono text-3xl font-semibold text-highlighted">{{ formatUSD(total) }}</span>
          </div>

          <UFormField label="Método de pago">
            <URadioGroup
              v-model="metodo"
              :items="metodoItems"
              orientation="horizontal"
              variant="card"
              :ui="{ fieldset: 'grid grid-cols-1 gap-2 sm:grid-cols-3' }"
            />
          </UFormField>

          <template v-if="metodo === 'efectivo'">
            <UFormField
              label="Monto recibido"
              :error="recibido !== undefined && 'error' in cobro ? cobro.error : undefined"
            >
              <div class="flex gap-2">
                <UInputNumber
                  v-model="recibido"
                  :min="0"
                  :step="0.01"
                  :format-options="{ style: 'currency', currency: 'USD' }"
                  autofocus
                  class="flex-1"
                />
                <UButton
                  label="Exacto"
                  color="neutral"
                  variant="outline"
                  @click="montoExacto"
                />
              </div>
            </UFormField>
            <div
              v-if="!('error' in cobro)"
              class="flex items-baseline justify-between"
            >
              <SectionLabel>Cambio</SectionLabel>
              <span class="carbon-data-mono text-2xl font-semibold text-success">{{ formatUSD(cobro.cambioCentavos) }}</span>
            </div>
          </template>

          <UAlert
            v-if="lineasSinStock.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Stock insuficiente"
            :description="`${lineasSinStock.map(l => l.nombre).join(', ')}: se puede vender, pero hay que actualizar el stock después.`"
          />
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="modalCobro = false"
          />
          <UButton
            type="submit"
            form="form-cobro"
            label="Confirmar venta"
            icon="i-lucide-check"
            :loading="cobrando"
            :disabled="'error' in cobro"
          />
        </div>
      </template>
    </UModal>

    <!-- Ticket -->
    <UModal
      v-model:open="modalTicket"
      title="Venta registrada"
      @after:leave="enfocarBusqueda"
    >
      <template #body>
        <div
          v-if="ventaHecha"
          class="space-y-3"
        >
          <UAlert
            v-if="ventaHecha.conStockInsuficiente"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Se vendió con stock insuficiente. Actualiza el stock con una entrada o un ajuste."
          />
          <div class="mx-auto max-w-72 border border-default p-4">
            <TicketVenta :venta="ventaHecha" />
          </div>
          <ZonaImpresion>
            <TicketVenta :venta="ventaHecha" />
          </ZonaImpresion>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Imprimir"
            icon="i-lucide-printer"
            color="neutral"
            variant="outline"
            @click="imprimir"
          />
          <UButton
            label="Nueva venta"
            icon="i-lucide-plus"
            @click="nuevaVenta"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
