<script setup lang="ts">
import type { VentaTicket } from '#shared/types/ventas'
import { formatFechaHora } from '~/utils/fechas'

// Ticket en formato de rollo (72 mm). Se usa en pantalla y dentro de <ZonaImpresion>.
defineProps<{ venta: VentaTicket }>()
</script>

<template>
  <div class="ticket">
    <div class="ticket-centro">
      <strong class="ticket-titulo">{{ venta.tiendaNombre }}</strong>
      <div v-if="venta.tiendaDireccion">
        {{ venta.tiendaDireccion }}
      </div>
    </div>

    <div class="ticket-linea" />
    <div class="ticket-fila">
      <span>Ticket</span><span>#{{ formatCorrelativo(venta.correlativo) }}</span>
    </div>
    <div class="ticket-fila">
      <span>Fecha</span><span>{{ formatFechaHora(venta.createdAt) }}</span>
    </div>
    <div class="ticket-fila">
      <span>Atendió</span><span>{{ venta.vendedor }}</span>
    </div>
    <div class="ticket-linea" />

    <div
      v-for="l in venta.detalle"
      :key="l.productoId"
      class="ticket-item"
    >
      <div>{{ l.nombreProducto }}</div>
      <div class="ticket-fila">
        <span>
          {{ formatCantidad(l.cantidad, l.unidadMedida) }} {{ UNIDAD_ABREV[l.unidadMedida] }} × {{ formatUSD(l.precioUnitarioCentavos) }}
        </span>
        <span>{{ formatUSD(l.subtotalCentavos) }}</span>
      </div>
    </div>

    <div class="ticket-linea" />
    <div class="ticket-fila ticket-total">
      <span>TOTAL</span><span>{{ formatUSD(venta.totalCentavos) }}</span>
    </div>
    <div class="ticket-fila">
      <span>{{ METODO_PAGO_LABEL[venta.metodoPago] }}</span><span>{{ formatUSD(venta.montoRecibidoCentavos) }}</span>
    </div>
    <div
      v-if="venta.metodoPago === 'efectivo'"
      class="ticket-fila"
    >
      <span>Cambio</span><span>{{ formatUSD(venta.cambioCentavos) }}</span>
    </div>

    <div
      v-if="venta.estado === 'anulada'"
      class="ticket-centro ticket-anulada"
    >
      *** VENTA ANULADA ***
    </div>
    <div class="ticket-linea" />
    <div class="ticket-centro">
      ¡Gracias por su compra!
    </div>
  </div>
</template>

<style scoped>
.ticket {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.4;
}

.ticket-centro {
  text-align: center;
}

.ticket-titulo {
  font-size: 14px;
}

.ticket-fila {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.ticket-item {
  margin-bottom: 4px;
}

.ticket-total {
  font-size: 14px;
  font-weight: 600;
}

.ticket-anulada {
  margin-top: 6px;
  font-weight: 600;
}

.ticket-linea {
  border-top: 1px dashed currentColor;
  margin: 6px 0;
}
</style>
