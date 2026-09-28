<script setup lang="ts">
import { authClient } from '~/utils/auth-client'

useSeoMeta({ title: 'Panel' })

const session = authClient.useSession()
const { estado, tiendaActiva } = useTiendaActiva()

const esAdmin = computed(() => session.value.data?.user.role === 'admin')
</script>

<template>
  <UDashboardPanel id="panel">
    <template #header>
      <PanelNavbar title="Panel" />
    </template>

    <template #body>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UCard variant="outline">
          <SectionLabel>Tienda activa</SectionLabel>
          <p class="mt-2 text-lg font-semibold text-highlighted">
            {{ tiendaActiva?.nombre ?? 'Sin tienda seleccionada' }}
          </p>
          <p
            v-if="tiendaActiva?.direccion"
            class="text-sm text-muted"
          >
            {{ tiendaActiva.direccion }}
          </p>
        </UCard>

        <UCard variant="outline">
          <SectionLabel>Usuario</SectionLabel>
          <p class="mt-2 text-lg font-semibold text-highlighted">
            {{ session.data?.user.name }}
          </p>
          <UBadge
            :label="esAdmin ? 'Admin' : 'Vendedora'"
            :color="esAdmin ? 'primary' : 'neutral'"
            variant="subtle"
            class="mt-1"
          />
        </UCard>

        <UCard variant="outline">
          <SectionLabel>Tiendas disponibles</SectionLabel>
          <p class="carbon-data-mono mt-2 text-lg font-semibold text-highlighted">
            {{ estado.tiendas.length }}
          </p>
        </UCard>
      </div>

      <UEmpty
        v-if="esAdmin && !estado.tiendas.length"
        icon="i-lucide-store"
        title="Aún no hay tiendas"
        description="Crea las tiendas y asigna vendedoras para empezar."
        :actions="[{ label: 'Crear tienda', icon: 'i-lucide-plus', to: '/admin/tiendas' }]"
        class="mt-6"
      />
    </template>
  </UDashboardPanel>
</template>
