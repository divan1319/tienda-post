<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Tiendas' })

interface Tienda {
  id: number
  nombre: string
  direccion: string | null
  activa: boolean
}

const toast = useToast()
const { cargar: recargarTiendasActivas } = useTiendaActiva()

const { data: tiendas, status, refresh } = await useFetch<Tienda[]>('/api/admin/tiendas', {
  default: () => []
})

const columns: TableColumn<Tienda>[] = [
  { accessorKey: 'nombre', header: 'Nombre' },
  { accessorKey: 'direccion', header: 'Dirección' },
  { accessorKey: 'activa', header: 'Estado' },
  { id: 'acciones', header: '' }
]

const schema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  direccion: z.string().trim().max(300).optional(),
  activa: z.boolean()
})
type Schema = z.output<typeof schema>

const abierto = ref(false)
const editando = ref<Tienda | null>(null)
const guardando = ref(false)
const state = reactive<Schema>({ nombre: '', direccion: '', activa: true })

function abrir(tienda?: Tienda) {
  editando.value = tienda ?? null
  Object.assign(state, {
    nombre: tienda?.nombre ?? '',
    direccion: tienda?.direccion ?? '',
    activa: tienda?.activa ?? true
  })
  abierto.value = true
}

async function guardar(event: FormSubmitEvent<Schema>) {
  guardando.value = true
  try {
    const body = { ...event.data, direccion: event.data.direccion || null }
    if (editando.value) {
      await $fetch(`/api/admin/tiendas/${editando.value.id}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/admin/tiendas', { method: 'POST', body })
    }
    toast.add({ title: editando.value ? 'Tienda actualizada' : 'Tienda creada', color: 'success' })
    abierto.value = false
    await Promise.all([refresh(), recargarTiendasActivas(true)])
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo guardar la tienda'), color: 'error' })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="tiendas">
    <template #header>
      <PanelNavbar title="Tiendas" />
    </template>

    <template #body>
      <div class="flex items-center justify-between">
        <SectionLabel>Tiendas <span class="carbon-data-mono">({{ tiendas.length }})</span></SectionLabel>
        <UButton
          label="Nueva tienda"
          icon="i-lucide-plus"
          @click="abrir()"
        />
      </div>

      <UTable
        :data="tiendas"
        :columns="columns"
        :loading="status === 'pending'"
        empty="No hay tiendas registradas."
        class="border border-default"
      >
        <template #direccion-cell="{ row }">
          <span class="text-muted">{{ row.original.direccion || '—' }}</span>
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
        :title="editando ? 'Editar tienda' : 'Nueva tienda'"
      >
        <template #body>
          <UForm
            id="form-tienda"
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
              label="Dirección"
              name="direccion"
            >
              <UTextarea
                v-model="state.direccion"
                :rows="2"
                class="w-full"
              />
            </UFormField>
            <UFormField
              name="activa"
              description="Una tienda inactiva no aparece para vender ni para elegir."
            >
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
              form="form-tienda"
              label="Guardar"
              :loading="guardando"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
