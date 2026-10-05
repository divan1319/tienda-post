<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { FilaImportacion, ResultadoAnalisis, ResultadoImportacion } from '#shared/utils/importacion-productos'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Importar productos' })

const toast = useToast()

const archivo = ref<File | null>(null)
const analisis = ref<ResultadoAnalisis | null>(null)
const errorArchivo = ref<string | null>(null)
const analizando = ref(false)
const importando = ref(false)
const resultado = ref<ResultadoImportacion | null>(null)

const POR_PAGINA = 50
const pagina = ref(1)

function formulario(f: File) {
  const form = new FormData()
  form.append('archivo', f)
  return form
}

// Cada archivo nuevo se analiza en el servidor (sin guardar); se descarta una
// respuesta que llegue después de cambiar de archivo
let consulta = 0
watch(archivo, async (f) => {
  const actual = ++consulta
  analisis.value = null
  errorArchivo.value = null
  resultado.value = null
  pagina.value = 1
  if (!f) return

  analizando.value = true
  try {
    const r = await $fetch<ResultadoAnalisis>('/api/productos/importacion/analizar', { method: 'POST', body: formulario(f) })
    if (actual === consulta) analisis.value = r
  } catch (err) {
    if (actual === consulta) errorArchivo.value = getErrorMessage(err, 'No se pudo leer el archivo.')
  } finally {
    if (actual === consulta) analizando.value = false
  }
})

async function importar() {
  if (!archivo.value || !analisis.value?.validas) return
  importando.value = true
  try {
    resultado.value = await $fetch<ResultadoImportacion>('/api/productos/importacion', { method: 'POST', body: formulario(archivo.value) })
    toast.add({
      title: `${resultado.value.creados} ${resultado.value.creados === 1 ? 'producto importado' : 'productos importados'}`,
      color: 'success'
    })
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo importar el archivo'), color: 'error' })
  } finally {
    importando.value = false
  }
}

function otroArchivo() {
  archivo.value = null
}

// ---------- Tabla de filas ----------

const soloErrores = ref(false)
watch(soloErrores, () => {
  pagina.value = 1
})

const filasVisibles = computed(() => {
  const filas = analisis.value?.filas ?? []
  return soloErrores.value ? filas.filter(f => f.errores.length) : filas
})
const filasPagina = computed(() => filasVisibles.value.slice((pagina.value - 1) * POR_PAGINA, pagina.value * POR_PAGINA))

const columns: TableColumn<FilaImportacion>[] = [
  { accessorKey: 'fila', header: 'Fila' },
  { accessorKey: 'nombre', header: 'Producto' },
  { accessorKey: 'categoria', header: 'Categoría' },
  { accessorKey: 'unidadMedida', header: 'Unidad' },
  { accessorKey: 'precioVentaCentavos', header: 'Precio' },
  { accessorKey: 'errores', header: 'Estado' }
]
</script>

<template>
  <UDashboardPanel id="importar-productos">
    <template #header>
      <PanelNavbar title="Importar productos" />
    </template>

    <template #body>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          to="/productos"
          label="Productos"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
        />
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <UCard variant="outline">
          <SectionLabel>1 · Descarga la plantilla</SectionLabel>
          <p class="mt-2 text-sm text-muted">
            Trae las columnas del formulario de producto: nombre, código de barras, categoría,
            unidad de medida y precio. Los productos se crean activos y sin foto. Si escribes una
            categoría que no existe, se crea al importar.
          </p>
          <UButton
            to="/api/productos/plantilla"
            external
            download
            label="Descargar plantilla (.xlsx)"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            class="mt-4"
          />
        </UCard>

        <UCard variant="outline">
          <SectionLabel>2 · Sube el archivo lleno</SectionLabel>
          <UFileUpload
            v-model="archivo"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            label="Arrastra el Excel o haz clic"
            description="Formato .xlsx, máximo 2 MB y 2000 productos."
            icon="i-lucide-file-spreadsheet"
            layout="list"
            class="mt-2 w-full"
          />
        </UCard>
      </div>

      <template v-if="archivo && !resultado">
        <SectionLabel>Vista previa del archivo</SectionLabel>
        <VistaPreviaExcel :archivo="archivo" />
      </template>

      <UAlert
        v-if="errorArchivo"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-x"
        title="No se puede importar este archivo"
        :description="errorArchivo"
      />

      <p
        v-if="analizando"
        class="text-sm text-muted"
      >
        Revisando las filas…
      </p>

      <template v-if="resultado">
        <div class="grid gap-4 sm:grid-cols-3">
          <StatTile
            etiqueta="Productos creados"
            :valor="String(resultado.creados)"
            tono="success"
          />
          <StatTile
            etiqueta="Filas omitidas"
            :valor="String(resultado.omitidas.length)"
            :tono="resultado.omitidas.length ? 'warning' : 'normal'"
          />
          <StatTile
            etiqueta="Categorías creadas"
            :valor="String(resultado.categoriasCreadas.length)"
            :detalle="resultado.categoriasCreadas.join(', ') || undefined"
          />
        </div>

        <template v-if="resultado.omitidas.length">
          <SectionLabel>Filas omitidas</SectionLabel>
          <ul class="divide-y divide-default border border-default">
            <li
              v-for="o in resultado.omitidas"
              :key="o.fila"
              class="px-3 py-2 text-sm"
            >
              <span class="carbon-data-mono text-muted">Fila {{ o.fila }}</span>
              <span class="ms-2 font-medium text-highlighted">{{ o.nombre || 'Sin nombre' }}</span>
              <p class="text-error">
                {{ o.errores.join(' ') }}
              </p>
            </li>
          </ul>
        </template>

        <div class="flex flex-wrap gap-2">
          <UButton
            to="/productos"
            label="Ver productos"
            icon="i-lucide-package"
          />
          <UButton
            label="Importar otro archivo"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="outline"
            @click="otroArchivo"
          />
        </div>
      </template>

      <template v-else-if="analisis">
        <div class="grid gap-4 sm:grid-cols-3">
          <StatTile
            etiqueta="Filas válidas"
            :valor="String(analisis.validas)"
            tono="success"
          />
          <StatTile
            etiqueta="Filas con errores"
            :valor="String(analisis.conErrores)"
            :tono="analisis.conErrores ? 'error' : 'normal'"
            :detalle="analisis.conErrores ? 'No se importan' : undefined"
          />
          <StatTile
            etiqueta="Categorías nuevas"
            :valor="String(analisis.categoriasNuevas.length)"
            :detalle="analisis.categoriasNuevas.join(', ') || undefined"
          />
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <SectionLabel>Filas del archivo <span class="carbon-data-mono">({{ filasVisibles.length }})</span></SectionLabel>
          <USwitch
            v-model="soloErrores"
            label="Solo filas con errores"
            :disabled="!analisis.conErrores"
          />
          <UButton
            :label="`Importar ${analisis.validas} ${analisis.validas === 1 ? 'producto' : 'productos'}`"
            icon="i-lucide-upload"
            :loading="importando"
            :disabled="!analisis.validas"
            class="ms-auto"
            @click="importar"
          />
        </div>

        <UTable
          :data="filasPagina"
          :columns="columns"
          empty="No hay filas con errores."
          class="border border-default"
        >
          <template #fila-cell="{ row }">
            <span class="carbon-data-mono">{{ row.original.fila }}</span>
          </template>
          <template #nombre-cell="{ row }">
            <p class="font-medium text-highlighted">
              {{ row.original.nombre || '—' }}
            </p>
            <p
              v-if="row.original.codigoBarras"
              class="carbon-data-mono text-xs text-muted"
            >
              {{ row.original.codigoBarras }}
            </p>
          </template>
          <template #categoria-cell="{ row }">
            <span
              v-if="!row.original.categoria"
              class="text-muted"
            >Sin categoría</span>
            <template v-else>
              {{ row.original.categoria.nombre }}
              <UBadge
                v-if="row.original.categoria.id === null"
                label="Nueva"
                color="info"
                variant="subtle"
                class="ms-1"
              />
            </template>
          </template>
          <template #unidadMedida-cell="{ row }">
            {{ row.original.unidadMedida ? UNIDAD_LABEL[row.original.unidadMedida] : '—' }}
          </template>
          <template #precioVentaCentavos-cell="{ row }">
            <span class="carbon-data-mono">
              {{ row.original.precioVentaCentavos === null ? '—' : formatUSD(row.original.precioVentaCentavos) }}
            </span>
          </template>
          <template #errores-cell="{ row }">
            <UBadge
              v-if="!row.original.errores.length"
              label="Lista"
              color="success"
              variant="subtle"
            />
            <ul
              v-else
              class="space-y-0.5 text-xs whitespace-normal text-error"
            >
              <li
                v-for="e in row.original.errores"
                :key="e"
              >
                {{ e }}
              </li>
            </ul>
          </template>
        </UTable>

        <div
          v-if="filasVisibles.length > POR_PAGINA"
          class="flex justify-end"
        >
          <UPagination
            v-model:page="pagina"
            :total="filasVisibles.length"
            :items-per-page="POR_PAGINA"
          />
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
