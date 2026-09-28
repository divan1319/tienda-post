<script setup lang="ts">
import type { VentaTicket } from '#shared/types/ventas'
import { getErrorMessage } from '~/utils/errors'
import { formatFechaHora } from '~/utils/fechas'

const props = defineProps<{ venta: VentaTicket }>()
const emit = defineEmits<{ actualizada: [venta: VentaTicket] }>()

const { esAdmin } = useUsuario()
const toast = useToast()

const anulando = ref(false)
const modalAnular = ref(false)
const motivo = ref('')

async function anular() {
  anulando.value = true
  try {
    const venta = await $fetch<VentaTicket>(`/api/ventas/${props.venta.id}/anular`, {
      method: 'POST',
      body: { motivo: motivo.value }
    })
    toast.add({ title: `Venta #${formatCorrelativo(venta.correlativo)} anulada; el stock se devolvió`, color: 'success' })
    modalAnular.value = false
    motivo.value = ''
    emit('actualizada', venta)
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo anular la venta'), color: 'error' })
  } finally {
    anulando.value = false
  }
}

function imprimir() {
  window.print()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <span class="carbon-data-mono text-lg font-semibold text-highlighted">#{{ formatCorrelativo(venta.correlativo) }}</span>
      <UBadge
        :label="venta.estado === 'anulada' ? 'Anulada' : 'Completada'"
        :color="venta.estado === 'anulada' ? 'error' : 'success'"
        variant="subtle"
      />
      <UBadge
        v-if="venta.conStockInsuficiente"
        label="Vendida sin stock suficiente"
        color="warning"
        variant="subtle"
      />
    </div>

    <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <dt class="text-muted">
        Tienda
      </dt>
      <dd>{{ venta.tiendaNombre }}</dd>
      <dt class="text-muted">
        Fecha
      </dt>
      <dd class="carbon-data-mono">
        {{ formatFechaHora(venta.createdAt) }}
      </dd>
      <dt class="text-muted">
        Vendedor
      </dt>
      <dd>{{ venta.vendedor }}</dd>
      <dt class="text-muted">
        Pago
      </dt>
      <dd>{{ METODO_PAGO_LABEL[venta.metodoPago] }}</dd>
    </dl>

    <ul class="divide-y divide-default border border-default">
      <li
        v-for="l in venta.detalle"
        :key="l.productoId"
        class="flex items-start justify-between gap-3 px-3 py-2 text-sm"
      >
        <div class="min-w-0">
          <p class="truncate">
            {{ l.nombreProducto }}
          </p>
          <p class="carbon-data-mono text-xs text-muted">
            {{ formatCantidad(l.cantidad, l.unidadMedida) }} {{ UNIDAD_ABREV[l.unidadMedida] }} × {{ formatUSD(l.precioUnitarioCentavos) }}
          </p>
        </div>
        <span class="carbon-data-mono">{{ formatUSD(l.subtotalCentavos) }}</span>
      </li>
    </ul>

    <div class="carbon-data-mono space-y-1 text-sm">
      <div class="flex justify-between text-base font-semibold text-highlighted">
        <span>Total</span><span>{{ formatUSD(venta.totalCentavos) }}</span>
      </div>
      <div class="flex justify-between text-muted">
        <span>Recibido</span><span>{{ formatUSD(venta.montoRecibidoCentavos) }}</span>
      </div>
      <div
        v-if="venta.metodoPago === 'efectivo'"
        class="flex justify-between text-muted"
      >
        <span>Cambio</span><span>{{ formatUSD(venta.cambioCentavos) }}</span>
      </div>
    </div>

    <UAlert
      v-if="venta.estado === 'anulada'"
      color="error"
      variant="subtle"
      icon="i-lucide-ban"
      title="Venta anulada"
      :description="`${venta.anuladaPorNombre ?? ''}${venta.anuladaAt ? ' · ' + formatFechaHora(venta.anuladaAt) : ''} — ${venta.motivoAnulacion ?? ''}`"
    />

    <div class="flex flex-wrap gap-2">
      <UButton
        label="Imprimir ticket"
        icon="i-lucide-printer"
        color="neutral"
        variant="outline"
        @click="imprimir"
      />
      <UButton
        v-if="esAdmin && venta.estado === 'completada'"
        label="Anular venta"
        icon="i-lucide-ban"
        color="error"
        variant="outline"
        @click="modalAnular = true"
      />
    </div>

    <ZonaImpresion>
      <TicketVenta :venta="venta" />
    </ZonaImpresion>

    <UModal
      v-model:open="modalAnular"
      title="Anular venta"
      :description="`Se devolverá el stock de la venta #${formatCorrelativo(venta.correlativo)}.`"
    >
      <template #body>
        <UFormField
          label="Motivo"
          required
        >
          <UTextarea
            v-model="motivo"
            :rows="2"
            autofocus
            class="w-full"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="modalAnular = false"
          />
          <UButton
            label="Anular"
            color="error"
            :loading="anulando"
            :disabled="motivo.trim().length < 3"
            @click="anular"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
