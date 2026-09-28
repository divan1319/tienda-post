<script setup lang="ts">
import type { TurnoConResumen } from '#shared/types/ventas'
import { formatFechaHora } from '~/utils/fechas'

// Corte de caja en formato de rollo para imprimir.
defineProps<{ turno: TurnoConResumen }>()
</script>

<template>
  <div>
    <div style="text-align: center">
      <strong>CORTE DE CAJA</strong>
      <div>{{ turno.tiendaNombre }}</div>
      <div>Turno #{{ turno.id }} · {{ turno.usuario }}</div>
    </div>
    <hr style="border-top: 1px dashed; margin: 6px 0">
    <div>Abierto: {{ formatFechaHora(turno.abiertoAt) }}</div>
    <div v-if="turno.cerradoAt">
      Cerrado: {{ formatFechaHora(turno.cerradoAt) }}
    </div>
    <hr style="border-top: 1px dashed; margin: 6px 0">
    <div
      v-for="m in turno.resumen.porMetodo"
      :key="m.metodoPago"
      style="display: flex; justify-content: space-between"
    >
      <span>{{ METODO_PAGO_LABEL[m.metodoPago] }} ({{ m.ventas }})</span><span>{{ formatUSD(m.totalCentavos) }}</span>
    </div>
    <div style="display: flex; justify-content: space-between">
      <strong>Total vendido</strong><strong>{{ formatUSD(turno.resumen.totalVendidoCentavos) }}</strong>
    </div>
    <hr style="border-top: 1px dashed; margin: 6px 0">
    <div style="display: flex; justify-content: space-between">
      <span>Inicial</span><span>{{ formatUSD(turno.montoInicialCentavos) }}</span>
    </div>
    <div style="display: flex; justify-content: space-between">
      <span>+ Ventas efectivo</span><span>{{ formatUSD(turno.resumen.ventasEfectivoCentavos) }}</span>
    </div>
    <div
      v-for="s in turno.resumen.salidas"
      :key="s.id"
      style="display: flex; justify-content: space-between"
    >
      <span>− {{ s.motivo }}</span><span>{{ formatUSD(s.montoCentavos) }}</span>
    </div>
    <div style="display: flex; justify-content: space-between">
      <strong>Esperado</strong><strong>{{ formatUSD(turno.efectivoEsperadoCentavos ?? turno.resumen.efectivoEsperadoCentavos) }}</strong>
    </div>
    <template v-if="turno.cerradoAt">
      <div style="display: flex; justify-content: space-between">
        <span>Contado</span><span>{{ formatUSD(turno.efectivoContadoCentavos ?? 0) }}</span>
      </div>
      <div style="display: flex; justify-content: space-between">
        <strong>Diferencia</strong><strong>{{ formatUSD(turno.diferenciaCentavos ?? 0) }}</strong>
      </div>
    </template>
    <div
      v-if="turno.nota"
      style="margin-top: 6px"
    >
      Nota: {{ turno.nota }}
    </div>
  </div>
</template>
