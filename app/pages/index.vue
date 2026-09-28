<script setup lang="ts">
import { hoyLocal } from '~/utils/fechas'

useSeoMeta({ title: 'Panel' })

const { usuario, esAdmin } = useUsuario()
const { estado, tiendaActiva } = useTiendaActiva()

// Ventas de hoy en la tienda activa (la vendedora ve solo las suyas)
const hoy = hoyLocal()
const { data: ventasHoy } = await useFetch('/api/ventas', {
  query: computed(() => ({
    tiendaId: esAdmin.value ? estado.value.tiendaActivaId ?? undefined : undefined,
    desde: hoy,
    hasta: hoy,
    limit: 1
  })),
  immediate: !!estado.value.tiendaActivaId
})

const { data: turnoActual } = await useFetch('/api/caja/turno-actual', {
  immediate: !!estado.value.tiendaActivaId
})
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
          <p class="mt-2 text-sm">
            {{ usuario?.name }}
            <UBadge
              :label="esAdmin ? 'Admin' : 'Vendedora'"
              :color="esAdmin ? 'primary' : 'neutral'"
              variant="subtle"
              class="ms-1"
            />
          </p>
        </UCard>

        <UCard variant="outline">
          <SectionLabel>{{ esAdmin ? 'Ventas de hoy en la tienda' : 'Mis ventas de hoy' }}</SectionLabel>
          <p class="carbon-data-mono mt-2 text-2xl font-semibold text-highlighted">
            {{ formatUSD(ventasHoy?.resumen.totalCentavos ?? 0) }}
          </p>
          <p class="carbon-data-mono text-sm text-muted">
            {{ ventasHoy?.resumen.ventas ?? 0 }} venta(s)
          </p>
        </UCard>

        <UCard variant="outline">
          <SectionLabel>Caja</SectionLabel>
          <p class="mt-2 text-sm">
            <UBadge
              :label="turnoActual?.turno ? 'Turno abierto' : 'Sin turno abierto'"
              :color="turnoActual?.turno ? 'success' : 'neutral'"
              variant="subtle"
            />
          </p>
          <p
            v-if="turnoActual?.turno"
            class="carbon-data-mono mt-2 text-sm text-muted"
          >
            Efectivo esperado: {{ formatUSD(turnoActual.turno.resumen.efectivoEsperadoCentavos) }}
          </p>
          <div class="mt-3 flex gap-2">
            <UButton
              to="/pos"
              label="Vender"
              icon="i-lucide-shopping-cart"
            />
            <UButton
              to="/caja"
              label="Caja"
              icon="i-lucide-wallet"
              color="neutral"
              variant="outline"
            />
          </div>
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
