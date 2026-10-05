<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Categorías' })

interface Categoria {
  id: number
  nombre: string
  codigo: string
  activa: boolean
  productos: number
}

const toast = useToast()

const { data: categorias, status, refresh } = await useFetch<Categoria[]>('/api/categorias', {
  query: { incluirInactivas: 'true' },
  default: () => []
})

const columns: TableColumn<Categoria>[] = [
  { accessorKey: 'nombre', header: 'Nombre' },
  { accessorKey: 'codigo', header: 'Código' },
  { accessorKey: 'productos', header: 'Productos' },
  { accessorKey: 'activa', header: 'Estado' },
  // Sin `header`: un string vacío provoca un desajuste de hidratación en UTable
  { id: 'acciones' }
]

const schema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100)
    .refine(n => codigoDesdeNombre(n) !== '', 'El nombre debe tener al menos una letra o un número'),
  activa: z.boolean()
})
type Schema = z.output<typeof schema>

const abierto = ref(false)
const editando = ref<Categoria | null>(null)
const guardando = ref(false)
const state = reactive<Schema>({ nombre: '', activa: true })

// Al crear, el código sale del nombre (el servidor lo vuelve a calcular); al editar no cambia
const codigo = computed(() => editando.value ? editando.value.codigo : codigoDesdeNombre(state.nombre))

function abrir(c?: Categoria) {
  editando.value = c ?? null
  Object.assign(state, { nombre: c?.nombre ?? '', activa: c?.activa ?? true })
  abierto.value = true
}

async function guardar(event: FormSubmitEvent<Schema>) {
  guardando.value = true
  try {
    if (editando.value) {
      await $fetch(`/api/categorias/${editando.value.id}`, { method: 'PUT', body: event.data })
    } else {
      await $fetch('/api/categorias', { method: 'POST', body: event.data })
    }
    toast.add({ title: editando.value ? 'Categoría actualizada' : 'Categoría creada', color: 'success' })
    abierto.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo guardar la categoría'), color: 'error' })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="categorias">
    <template #header>
      <PanelNavbar title="Categorías" />
    </template>

    <template #body>
      <div class="flex items-center justify-between">
        <SectionLabel>Categorías <span class="carbon-data-mono">({{ categorias.length }})</span></SectionLabel>
        <UButton
          label="Nueva categoría"
          icon="i-lucide-plus"
          @click="abrir()"
        />
      </div>

      <UTable
        :data="categorias"
        :columns="columns"
        :loading="status === 'pending'"
        empty="No hay categorías. Los productos sin categoría aparecen como «Sin categoría»."
        class="border border-default"
      >
        <template #codigo-cell="{ row }">
          <span class="carbon-data-mono text-muted">{{ row.original.codigo }}</span>
        </template>
        <template #productos-cell="{ row }">
          <span class="carbon-data-mono">{{ row.original.productos }}</span>
        </template>
        <template #activa-cell="{ row }">
          <UBadge
            :label="row.original.activa ? 'Activa' : 'Inactiva'"
            :color="row.original.activa ? 'success' : 'neutral'"
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

      <UModal
        v-model:open="abierto"
        :title="editando ? 'Editar categoría' : 'Nueva categoría'"
      >
        <template #body>
          <UForm
            id="form-categoria"
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
              label="Código"
              :help="editando ? 'El código se asignó al crear la categoría y no cambia al editar el nombre.' : 'Se genera a partir del nombre.'"
            >
              <UInput
                :model-value="codigo"
                placeholder="nombre_de_la_categoria"
                disabled
                class="carbon-data-mono w-full"
              />
            </UFormField>
            <UFormField name="activa">
              <USwitch
                v-model="state.activa"
                label="Activa"
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
              form="form-categoria"
              label="Guardar"
              :loading="guardando"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
