<script setup lang="ts">
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

// Pedidos pendientes de todas las tiendas (solo admin): hoy, atrasados y próximos
const { data: pedidos } = await useFetch('/api/pedidos', {
  query: { estado: 'pendiente', limit: 200 },
  immediate: esAdmin.value
})
const pendientes = computed(() => pedidos.value?.items ?? [])
const grupos = computed(() => ({
  atrasado: pendientes.value.filter(p => p.situacion === 'atrasado'),
  hoy: pendientes.value.filter(p => p.situacion === 'hoy'),
  proximo: pendientes.value.filter(p => p.situacion === 'proximo')
}))
const GRUPO_LABEL = { hoy: 'Hoy', atrasado: 'Atrasados', proximo: 'Próximos' } as const

function formatFecha(fecha: string) {
  const [a, m, d] = fecha.split('-')
  return `${d}/${m}/${a}`
}
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

      <UCard
        v-if="esAdmin"
        variant="outline"
        class="mt-4"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <SectionLabel>Pedidos pendientes</SectionLabel>
            <UButton
              to="/pedidos"
              label="Ver pedidos"
              size="xs"
              color="neutral"
              variant="outline"
            />
          </div>
        </template>
        <UEmpty
          v-if="!pendientes.length"
          icon="i-lucide-clipboard-check"
          title="Sin pedidos pendientes"
          variant="naked"
          size="sm"
        />
        <div
          v-else
          class="grid gap-4 lg:grid-cols-3"
        >
          <div
            v-for="clave in (['hoy', 'atrasado', 'proximo'] as const)"
            :key="clave"
          >
            <p class="mb-2 flex items-center gap-2 text-sm font-medium">
              {{ GRUPO_LABEL[clave] }}
              <UBadge
                :label="String(grupos[clave].length)"
                :color="clave === 'atrasado' && grupos[clave].length ? 'error' : clave === 'hoy' && grupos[clave].length ? 'warning' : 'neutral'"
                variant="subtle"
              />
            </p>
            <ul
              v-if="grupos[clave].length"
              class="divide-y divide-default border border-default text-sm"
            >
              <li
                v-for="p in grupos[clave].slice(0, 6)"
                :key="p.id"
                class="flex justify-between gap-2 px-3 py-2"
              >
                <span class="min-w-0 truncate">
                  {{ p.nombre }}
                  <span class="block text-xs text-muted">{{ p.tiendaNombre }}{{ p.proveedor ? ` · ${p.proveedor}` : '' }}</span>
                </span>
                <span class="carbon-data-mono shrink-0 text-xs text-muted">{{ formatFecha(p.fechaEsperada) }}</span>
              </li>
            </ul>
            <p
              v-else
              class="text-sm text-muted"
            >
              —
            </p>
          </div>
        </div>
      </UCard>

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
