<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { authClient } from '~/utils/auth-client'

const { usuario, esAdmin } = useUsuario()
const { limpiar } = useTiendaActiva()

const items = computed<NavigationMenuItem[][]>(() => {
  const general: NavigationMenuItem[] = [
    { label: 'Panel', icon: 'i-lucide-layout-dashboard', to: '/' }
  ]

  if (!esAdmin.value) return [general]

  return [
    general,
    [
      { label: 'Tiendas', icon: 'i-lucide-store', to: '/admin/tiendas' },
      { label: 'Usuarios', icon: 'i-lucide-users', to: '/admin/usuarios' }
    ]
  ]
})

async function cerrarSesion() {
  await authClient.signOut()
  limpiar()
  usuario.value = null
  await navigateTo('/login')
}
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible>
      <template #header="{ collapsed }">
        <AppLogo :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          v-for="(grupo, i) in items"
          :key="i"
          :items="grupo"
          :collapsed="collapsed"
          orientation="vertical"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex w-full flex-col gap-2">
          <div
            v-if="!collapsed && usuario"
            class="min-w-0 px-2"
          >
            <p class="truncate text-sm font-medium text-highlighted">
              {{ usuario.name }}
            </p>
            <p class="truncate text-xs text-muted">
              {{ usuario.email }}
            </p>
          </div>
          <UButton
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            :label="collapsed ? undefined : 'Cerrar sesión'"
            :square="collapsed"
            block
            @click="cerrarSesion"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
