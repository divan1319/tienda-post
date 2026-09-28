<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { authClient } from '~/utils/auth-client'

const session = authClient.useSession()
const { limpiar } = useTiendaActiva()

const esAdmin = computed(() => session.value.data?.user.role === 'admin')

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
            v-if="!collapsed && session.data"
            class="min-w-0 px-2"
          >
            <p class="truncate text-sm font-medium text-highlighted">
              {{ session.data.user.name }}
            </p>
            <p class="truncate text-xs text-muted">
              {{ session.data.user.email }}
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
