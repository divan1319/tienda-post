<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Rol } from '#shared/roles'
import { authClient } from '~/utils/auth-client'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Usuarios' })

interface Usuario {
  id: string
  name: string
  email: string
  role: string | null
  banned: boolean | null
  tiendaActivaId: number | null
  tiendaIds: number[]
}

interface Tienda {
  id: number
  nombre: string
  activa: boolean
}

const toast = useToast()
const { usuario: yo } = useUsuario()

const [{ data: usuarios, status, refresh }, { data: tiendas }] = await Promise.all([
  useFetch<Usuario[]>('/api/admin/usuarios', { default: () => [] }),
  useFetch<Tienda[]>('/api/admin/tiendas', { default: () => [] })
])

const rolItems: { label: string, value: Rol }[] = [
  { label: 'Vendedora', value: 'vendedora' },
  { label: 'Admin', value: 'admin' }
]

// UCheckboxGroup trabaja con valores string
const tiendaItems = computed(() => tiendas.value.map(t => ({
  value: String(t.id),
  label: t.activa ? t.nombre : `${t.nombre} (inactiva)`
})))

const nombreTienda = (id: number) => tiendas.value.find(t => t.id === id)?.nombre ?? `#${id}`

const columns: TableColumn<Usuario>[] = [
  { accessorKey: 'name', header: 'Nombre' },
  { accessorKey: 'email', header: 'Correo' },
  { accessorKey: 'role', header: 'Rol' },
  { accessorKey: 'tiendaIds', header: 'Tiendas' },
  { accessorKey: 'banned', header: 'Estado' },
  // Sin `header`: un string vacío provoca un desajuste de hidratación en UTable
  { id: 'acciones' }
]

function esYo(u: Usuario) {
  return u.id === yo.value?.id
}

function falla(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback)
}

// ---------- Crear / editar ----------

const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  email: z.email('Correo no válido'),
  password: z.string(),
  role: z.enum(['admin', 'vendedora']),
  tiendaIds: z.array(z.string())
})
type Schema = z.output<typeof schema>

const abierto = ref(false)
const editando = ref<Usuario | null>(null)
const guardando = ref(false)
const state = reactive<Schema>({ name: '', email: '', password: '', role: 'vendedora', tiendaIds: [] })

function abrir(u?: Usuario) {
  editando.value = u ?? null
  Object.assign(state, {
    name: u?.name ?? '',
    email: u?.email ?? '',
    password: '',
    role: (u?.role as Rol) ?? 'vendedora',
    tiendaIds: (u?.tiendaIds ?? []).map(String)
  })
  abierto.value = true
}

function validar(s: Partial<Schema>) {
  const errores: { name: string, message: string }[] = []
  const minimo = 8
  if (!editando.value && (s.password?.length ?? 0) < minimo) {
    errores.push({ name: 'password', message: `Mínimo ${minimo} caracteres` })
  }
  if (editando.value && s.password && s.password.length < minimo) {
    errores.push({ name: 'password', message: `Mínimo ${minimo} caracteres` })
  }
  return errores
}

async function guardar(event: FormSubmitEvent<Schema>) {
  const datos = event.data
  guardando.value = true
  try {
    let userId: string

    if (editando.value) {
      userId = editando.value.id
      if (datos.role !== editando.value.role) {
        const { error } = await authClient.admin.setRole({ userId, role: datos.role })
        if (error) falla(error, 'No se pudo cambiar el rol')
      }
      if (datos.password) {
        const { error } = await authClient.admin.setUserPassword({ userId, newPassword: datos.password })
        if (error) falla(error, 'No se pudo cambiar la contraseña')
      }
    } else {
      const { data, error } = await authClient.admin.createUser({
        name: datos.name,
        email: datos.email,
        password: datos.password,
        role: datos.role
      })
      if (error || !data) falla(error, 'No se pudo crear el usuario')
      userId = data.user.id
    }

    await $fetch(`/api/admin/usuarios/${userId}/tiendas`, {
      method: 'PUT',
      body: { tiendaIds: datos.tiendaIds.map(Number) }
    })

    toast.add({ title: editando.value ? 'Usuario actualizado' : 'Usuario creado', color: 'success' })
    abierto.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo guardar el usuario'), color: 'error' })
  } finally {
    guardando.value = false
  }
}

// ---------- Activar / desactivar ----------

async function alternarAcceso(u: Usuario) {
  try {
    const { error } = u.banned
      ? await authClient.admin.unbanUser({ userId: u.id })
      : await authClient.admin.banUser({ userId: u.id })
    if (error) falla(error, 'No se pudo actualizar el acceso')
    toast.add({ title: u.banned ? 'Acceso reactivado' : 'Acceso desactivado', color: 'success' })
    await refresh()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo actualizar el acceso'), color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="usuarios">
    <template #header>
      <PanelNavbar title="Usuarios" />
    </template>

    <template #body>
      <div class="flex items-center justify-between">
        <SectionLabel>Usuarios <span class="carbon-data-mono">({{ usuarios.length }})</span></SectionLabel>
        <UButton
          label="Nuevo usuario"
          icon="i-lucide-user-plus"
          @click="abrir()"
        />
      </div>

      <UTable
        :data="usuarios"
        :columns="columns"
        :loading="status === 'pending'"
        empty="No hay usuarios."
        class="border border-default"
      >
        <template #email-cell="{ row }">
          <span class="carbon-data-mono text-muted">{{ row.original.email }}</span>
        </template>
        <template #role-cell="{ row }">
          <UBadge
            :label="row.original.role === 'admin' ? 'Admin' : 'Vendedora'"
            :color="row.original.role === 'admin' ? 'primary' : 'neutral'"
            variant="subtle"
          />
        </template>
        <template #tiendaIds-cell="{ row }">
          <span
            v-if="row.original.role === 'admin'"
            class="text-muted"
          >Todas</span>
          <div
            v-else-if="row.original.tiendaIds.length"
            class="flex flex-wrap gap-1"
          >
            <UBadge
              v-for="id in row.original.tiendaIds"
              :key="id"
              :label="nombreTienda(id)"
              color="neutral"
              variant="outline"
            />
          </div>
          <span
            v-else
            class="text-warning"
          >Sin tiendas</span>
        </template>
        <template #banned-cell="{ row }">
          <UBadge
            :label="row.original.banned ? 'Desactivado' : 'Activo'"
            :color="row.original.banned ? 'error' : 'success'"
            variant="subtle"
          />
        </template>
        <template #acciones-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              aria-label="Editar"
              @click="abrir(row.original)"
            />
            <UButton
              :icon="row.original.banned ? 'i-lucide-user-check' : 'i-lucide-user-x'"
              :color="row.original.banned ? 'success' : 'error'"
              variant="ghost"
              :aria-label="row.original.banned ? 'Reactivar acceso' : 'Desactivar acceso'"
              :disabled="esYo(row.original)"
              @click="alternarAcceso(row.original)"
            />
          </div>
        </template>
      </UTable>

      <UModal
        v-model:open="abierto"
        :title="editando ? 'Editar usuario' : 'Nuevo usuario'"
      >
        <template #body>
          <UForm
            id="form-usuario"
            :schema="schema"
            :state="state"
            :validate="validar"
            class="space-y-4"
            @submit="guardar"
          >
            <UFormField
              label="Nombre"
              name="name"
              required
            >
              <UInput
                v-model="state.name"
                :disabled="!!editando"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Correo electrónico"
              name="email"
              required
            >
              <UInput
                v-model="state.email"
                type="email"
                :disabled="!!editando"
                class="w-full"
              />
            </UFormField>
            <UFormField
              :label="editando ? 'Nueva contraseña' : 'Contraseña'"
              name="password"
              :required="!editando"
              :help="editando ? 'Déjala vacía para no cambiarla.' : undefined"
            >
              <UInput
                v-model="state.password"
                type="password"
                autocomplete="new-password"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Rol"
              name="role"
              required
            >
              <USelect
                v-model="state.role"
                :items="rolItems"
                :disabled="!!editando && esYo(editando)"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="state.role === 'vendedora'"
              label="Tiendas asignadas"
              name="tiendaIds"
            >
              <UCheckboxGroup
                v-model="state.tiendaIds"
                :items="tiendaItems"
              />
              <p
                v-if="!tiendaItems.length"
                class="text-sm text-muted"
              >
                Primero crea una tienda.
              </p>
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
              form="form-usuario"
              label="Guardar"
              :loading="guardando"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
