<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Productos' })

const toast = useToast()
const { tiendaId } = useTiendaSeleccionada()

// ---------- Filtros y listado ----------

const POR_PAGINA = 50
const busqueda = ref('')
const q = useDebounced(busqueda)
const categoriaFiltro = ref<string>('todas')
const pagina = ref(1)

watch([q, categoriaFiltro, tiendaId], () => {
  pagina.value = 1
})

const { data: categorias } = await useFetch('/api/categorias', {
  query: { incluirInactivas: 'true' },
  default: () => []
})

const { data, status, refresh } = await useFetch('/api/productos', {
  query: computed(() => ({
    tiendaId: tiendaId.value,
    q: q.value || undefined,
    categoriaId: categoriaFiltro.value === 'todas' ? undefined : categoriaFiltro.value,
    incluirInactivos: 'true',
    limit: POR_PAGINA,
    offset: (pagina.value - 1) * POR_PAGINA
  })),
  immediate: !!tiendaId.value
})

type Producto = NonNullable<typeof data.value>['items'][number]
const productos = computed(() => data.value?.items ?? [])

const categoriaItems = computed(() => [
  { label: 'Todas las categorías', value: 'todas' },
  { label: 'Sin categoría', value: 'sin' },
  ...categorias.value.map(c => ({ label: c.nombre, value: String(c.id) }))
])

const columns: TableColumn<Producto>[] = [
  { accessorKey: 'nombre', header: 'Producto' },
  { accessorKey: 'categoriaNombre', header: 'Categoría' },
  { accessorKey: 'precioVentaCentavos', header: 'Precio' },
  { accessorKey: 'stock', header: 'Stock' },
  { accessorKey: 'activo', header: 'Estado' },
  // Sin `header`: un string vacío provoca un desajuste de hidratación en UTable
  { id: 'acciones' }
]

// ---------- Alta y edición ----------

const unidadItems = UNIDADES_MEDIDA.map(u => ({ label: UNIDAD_LABEL[u], value: u }))

const schema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  codigoBarras: z.string().trim().max(64).optional(),
  categoriaId: z.number().optional(),
  unidadMedida: z.enum(UNIDADES_MEDIDA),
  precio: z.number({ error: 'Ingresa el precio' }).min(0, 'El precio no puede ser negativo'),
  activo: z.boolean()
})
type Schema = z.output<typeof schema>

const abierto = ref(false)
const editando = ref<Producto | null>(null)
const guardando = ref(false)
const foto = ref<File | null>(null)
const state = reactive<Partial<Schema>>({})

function abrir(p?: Producto) {
  editando.value = p ?? null
  foto.value = null
  Object.assign(state, {
    nombre: p?.nombre ?? '',
    codigoBarras: p?.codigoBarras ?? '',
    categoriaId: p?.categoriaId ?? undefined,
    unidadMedida: p?.unidadMedida ?? 'unidad',
    precio: p ? centavosADolares(p.precioVentaCentavos) : undefined,
    activo: p?.activo ?? true
  })
  abierto.value = true
}

async function guardar(event: FormSubmitEvent<Schema>) {
  const { precio, ...datos } = event.data
  const body = {
    ...datos,
    codigoBarras: datos.codigoBarras || null,
    categoriaId: datos.categoriaId ?? null,
    precioVentaCentavos: dolaresACentavos(precio)
  }

  guardando.value = true
  try {
    const guardado = editando.value
      ? await $fetch(`/api/productos/${editando.value.id}`, { method: 'PUT', body })
      : await $fetch('/api/productos', { method: 'POST', body })

    if (foto.value && guardado) {
      const form = new FormData()
      form.append('archivo', foto.value)
      try {
        await $fetch(`/api/productos/${guardado.id}/foto`, { method: 'POST', body: form })
      } catch (err) {
        toast.add({ title: getErrorMessage(err, 'El producto se guardó, pero no se pudo subir la foto'), color: 'warning' })
      }
    }

    toast.add({ title: editando.value ? 'Producto actualizado' : 'Producto creado', color: 'success' })
    abierto.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo guardar el producto'), color: 'error' })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="productos">
    <template #header>
      <PanelNavbar title="Productos" />
    </template>

    <template #body>
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="busqueda"
          icon="i-lucide-search"
          placeholder="Buscar por nombre o código"
          class="w-64"
        />
        <USelect
          v-model="categoriaFiltro"
          :items="categoriaItems"
          class="w-52"
        />
        <TiendaFiltro />
        <div class="ms-auto">
          <UButton
            label="Nuevo producto"
            icon="i-lucide-plus"
            @click="abrir()"
          />
        </div>
      </div>

      <SectionLabel>
        Productos <span class="carbon-data-mono">({{ data?.total ?? 0 }})</span> · stock de la tienda seleccionada
      </SectionLabel>

      <UTable
        :data="productos"
        :columns="columns"
        :loading="status === 'pending'"
        empty="No hay productos que coincidan."
        class="border border-default"
      >
        <template #nombre-cell="{ row }">
          <div class="flex items-center gap-3">
            <img
              v-if="row.original.fotoKey"
              :src="`/api/files/${row.original.fotoKey}`"
              :alt="row.original.nombre"
              class="size-9 rounded-xs border border-default object-cover"
              loading="lazy"
            >
            <div
              v-else
              class="flex size-9 items-center justify-center rounded-xs border border-default text-muted"
            >
              <UIcon name="i-lucide-package" />
            </div>
            <div class="min-w-0">
              <p class="truncate font-medium text-highlighted">
                {{ row.original.nombre }}
              </p>
              <p
                v-if="row.original.codigoBarras"
                class="carbon-data-mono text-xs text-muted"
              >
                {{ row.original.codigoBarras }}
              </p>
            </div>
          </div>
        </template>
        <template #categoriaNombre-cell="{ row }">
          <span :class="row.original.categoriaNombre ? '' : 'text-muted'">
            {{ row.original.categoriaNombre ?? 'Sin categoría' }}
          </span>
        </template>
        <template #precioVentaCentavos-cell="{ row }">
          <span class="carbon-data-mono">{{ formatUSD(row.original.precioVentaCentavos) }}</span>
          <span class="text-xs text-muted"> / {{ UNIDAD_ABREV[row.original.unidadMedida] }}</span>
        </template>
        <template #stock-cell="{ row }">
          <span
            class="carbon-data-mono"
            :class="row.original.stock < 0 ? 'text-error' : ''"
          >
            {{ formatCantidad(row.original.stock, row.original.unidadMedida) }}
          </span>
          <UBadge
            v-if="row.original.stock < 0"
            label="Por corregir"
            color="error"
            variant="subtle"
            class="ms-2"
          />
          <UBadge
            v-else-if="row.original.stockMinimo !== null && row.original.stock <= row.original.stockMinimo"
            label="Stock bajo"
            color="warning"
            variant="subtle"
            class="ms-2"
          />
        </template>
        <template #activo-cell="{ row }">
          <UBadge
            :label="row.original.activo ? 'Activo' : 'Inactivo'"
            :color="row.original.activo ? 'success' : 'neutral'"
            variant="subtle"
          />
        </template>
        <template #acciones-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              aria-label="Editar"
              @click="abrir(row.original)"
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

      <UModal
        v-model:open="abierto"
        :title="editando ? 'Editar producto' : 'Nuevo producto'"
      >
        <template #body>
          <UForm
            id="form-producto"
            :schema="schema"
            :state="state"
            class="space-y-4"
            @submit="guardar"
          >
            <UFormField
              label="Nombre"
              name="nombre"
              required
            >
              <UInput
                v-model="state.nombre"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Código de barras"
              name="codigoBarras"
              help="Opcional. Puedes escanearlo con el lector."
            >
              <UInput
                v-model="state.codigoBarras"
                class="carbon-data-mono w-full"
              />
            </UFormField>
            <UFormField
              label="Categoría"
              name="categoriaId"
            >
              <USelectMenu
                v-model="state.categoriaId"
                :items="categorias.filter(c => c.activa || c.id === state.categoriaId)"
                value-key="id"
                label-key="nombre"
                placeholder="Sin categoría"
                clear
                class="w-full"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-4">
              <UFormField
                label="Unidad de medida"
                name="unidadMedida"
                required
              >
                <USelect
                  v-model="state.unidadMedida"
                  :items="unidadItems"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                :label="`Precio por ${UNIDAD_LABEL[state.unidadMedida ?? 'unidad'].toLowerCase()}`"
                name="precio"
                required
              >
                <UInputNumber
                  v-model="state.precio"
                  :min="0"
                  :step="0.01"
                  :format-options="{ style: 'currency', currency: 'USD' }"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField
              label="Foto"
              name="foto"
              help="JPG, PNG o WEBP, máximo 5 MB."
            >
              <UFileUpload
                v-model="foto"
                accept="image/jpeg,image/png,image/webp"
                label="Arrastra una imagen o haz clic"
                layout="list"
                class="w-full"
              />
            </UFormField>
            <UFormField
              name="activo"
              description="Un producto inactivo no aparece para vender."
            >
              <USwitch
                v-model="state.activo"
                label="Activo"
              />
            </UFormField>
          </UForm>
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
              form="form-producto"
              label="Guardar"
              :loading="guardando"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
