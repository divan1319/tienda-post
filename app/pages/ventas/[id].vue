<script setup lang="ts">
import type { VentaTicket } from '#shared/types/ventas'

const route = useRoute()

const { data: venta, error } = await useFetch<VentaTicket>(() => `/api/ventas/${route.params.id}`)

useSeoMeta({ title: () => venta.value ? `Venta #${formatCorrelativo(venta.value.correlativo)}` : 'Venta' })
</script>

<template>
  <UDashboardPanel id="venta">
    <template #header>
      <PanelNavbar title="Venta" />
    </template>

    <template #body>
      <div class="max-w-xl">
        <UButton
          to="/ventas"
          label="Ventas"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          class="mb-2"
        />
        <UEmpty
          v-if="error"
          icon="i-lucide-receipt"
          title="Venta no encontrada"
        />
        <VentaDetalle
          v-else-if="venta"
          :venta="venta"
          @actualizada="(v) => venta = v"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
