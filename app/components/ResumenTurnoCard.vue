<script setup lang="ts">
import type { TurnoConResumen } from '#shared/types/ventas'
import { formatFechaHora } from '~/utils/fechas'

// Resumen de un turno: ventas por método, salidas y efectivo esperado (y el corte si está cerrado).
defineProps<{ turno: TurnoConResumen }>()
</script>

<template>
  <div class="space-y-4">
    <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <template v-if="turno.tiendaNombre">
        <dt class="text-muted">
          Tienda
        </dt>
        <dd>{{ turno.tiendaNombre }}</dd>
      </template>
      <template v-if="turno.usuario">
        <dt class="text-muted">
          Usuario
        </dt>
        <dd>{{ turno.usuario }}</dd>
      </template>
      <dt class="text-muted">
        Abierto
      </dt>
      <dd class="carbon-data-mono">
        {{ formatFechaHora(turno.abiertoAt) }}
      </dd>
      <template v-if="turno.cerradoAt">
        <dt class="text-muted">
          Cerrado
        </dt>
        <dd class="carbon-data-mono">
          {{ formatFechaHora(turno.cerradoAt) }}
        </dd>
      </template>
    </dl>

    <div>
      <SectionLabel>Ventas del turno</SectionLabel>
      <ul class="mt-2 divide-y divide-default border border-default text-sm">
        <li
          v-for="m in turno.resumen.porMetodo"
          :key="m.metodoPago"
          class="flex justify-between px-3 py-2"
        >
          <span>{{ METODO_PAGO_LABEL[m.metodoPago] }} <span class="carbon-data-mono text-muted">({{ m.ventas }})</span></span>
          <span class="carbon-data-mono">{{ formatUSD(m.totalCentavos) }}</span>
        </li>
        <li class="flex justify-between px-3 py-2 font-semibold text-highlighted">
          <span>Total vendido <span class="carbon-data-mono font-normal text-muted">({{ turno.resumen.ventas }})</span></span>
          <span class="carbon-data-mono">{{ formatUSD(turno.resumen.totalVendidoCentavos) }}</span>
        </li>
      </ul>
      <p
        v-if="turno.resumen.ventasAnuladas"
        class="mt-1 text-xs text-muted"
      >
        {{ turno.resumen.ventasAnuladas }} venta(s) anulada(s), no suman.
      </p>
    </div>

    <div v-if="turno.resumen.salidas.length">
      <SectionLabel>Salidas de efectivo</SectionLabel>
      <ul class="mt-2 divide-y divide-default border border-default text-sm">
        <li
          v-for="s in turno.resumen.salidas"
          :key="s.id"
          class="flex justify-between gap-3 px-3 py-2"
        >
          <span class="min-w-0">
            {{ s.motivo }}
            <span class="block text-xs text-muted">{{ s.usuario }} · <span class="carbon-data-mono">{{ formatFechaHora(s.createdAt) }}</span></span>
          </span>
          <span class="carbon-data-mono text-error">−{{ formatUSD(s.montoCentavos) }}</span>
        </li>
      </ul>
    </div>

    <div>
      <SectionLabel>Efectivo</SectionLabel>
      <div class="carbon-data-mono mt-2 space-y-1 text-sm">
        <div class="flex justify-between">
          <span class="text-muted">Inicial</span><span>{{ formatUSD(turno.montoInicialCentavos) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">+ Ventas en efectivo</span><span>{{ formatUSD(turno.resumen.ventasEfectivoCentavos) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">− Salidas</span><span>{{ formatUSD(turno.resumen.salidasCentavos) }}</span>
        </div>
        <div class="flex justify-between border-t border-default pt-1 font-semibold text-highlighted">
          <span>Esperado</span>
          <span>{{ formatUSD(turno.efectivoEsperadoCentavos ?? turno.resumen.efectivoEsperadoCentavos) }}</span>
        </div>
        <template v-if="turno.cerradoAt">
          <div class="flex justify-between">
            <span class="text-muted">Contado</span><span>{{ formatUSD(turno.efectivoContadoCentavos ?? 0) }}</span>
          </div>
          <div
            class="flex justify-between font-semibold"
            :class="(turno.diferenciaCentavos ?? 0) < 0 ? 'text-error' : (turno.diferenciaCentavos ?? 0) > 0 ? 'text-warning' : 'text-success'"
          >
            <span>Diferencia</span>
            <span>{{ (turno.diferenciaCentavos ?? 0) > 0 ? '+' : '' }}{{ formatUSD(turno.diferenciaCentavos ?? 0) }}</span>
          </div>
        </template>
      </div>
      <p
        v-if="turno.nota"
        class="mt-2 text-sm text-muted"
      >
        Nota: {{ turno.nota }}
      </p>
    </div>
  </div>
</template>
