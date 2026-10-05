<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { CalendarDate } from '@internationalized/date'
import { parseDate } from '@internationalized/date'
import ReporteVentas from '~/components/reportes/ReporteVentas.vue'
import ReporteCompras from '~/components/reportes/ReporteCompras.vue'
import ReporteCortes from '~/components/reportes/ReporteCortes.vue'
import ReporteResumen from '~/components/reportes/ReporteResumen.vue'
import type { FiltrosReporte } from '~/composables/useFiltrosReporte'

definePageMeta({ admin: true })

useSeoMeta({ title: 'Reportes' })

const { estado } = useTiendaActiva()

type Reporte = 'ventas' | 'compras' | 'cortes' | 'resumen'
const reporte = ref<Reporte>('ventas')
const reportes: TabsItem[] = [
  { label: 'Ventas', value: 'ventas', icon: 'i-lucide-receipt' },
  { label: 'Compras', value: 'compras', icon: 'i-lucide-shopping-bag' },
  { label: 'Cortes de caja', value: 'cortes', icon: 'i-lucide-wallet' },
  { label: 'Resumen', value: 'resumen', icon: 'i-lucide-scale' }
]

// ---------- Filtros (una fila arriba; afectan a todo el reporte) ----------

const periodo = ref<Periodo>('dia')
const periodos: TabsItem[] = [
  { label: 'Día', value: 'dia' },
  { label: 'Mes', value: 'mes' },
  { label: 'Año', value: 'anio' }
]

const tienda = ref('todas')
const tiendaItems = computed(() => [
  { label: 'Todas las tiendas', value: 'todas' },
  ...estado.value.tiendas.map(t => ({ label: t.nombre, value: String(t.id) }))
])

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

const hoy = hoyLocal()
// Fuera de reactive(): reactive() pierde el tipo de CalendarDate (campos privados)
const desde = shallowRef<CalendarDate>(parseDate(`${hoy.slice(0, 7)}-01`))
const hasta = shallowRef<CalendarDate>(parseDate(hoy))

const presets: { label: string, desde: string, hasta: string, periodo: Periodo }[] = [
  { label: 'Hoy', desde: hoy, hasta: hoy, periodo: 'dia' },
  { label: 'Últimos 7 días', desde: sumarDias(hoy, -6), hasta: hoy, periodo: 'dia' },
  { label: 'Este mes', desde: `${hoy.slice(0, 7)}-01`, hasta: hoy, periodo: 'dia' },
  { label: 'Últimos 30 días', desde: sumarDias(hoy, -29), hasta: hoy, periodo: 'dia' },
  { label: 'Este año', desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, periodo: 'mes' }
]

function aplicarPreset(p: typeof presets[number]) {
  desde.value = parseDate(p.desde)
  hasta.value = parseDate(p.hasta)
  periodo.value = p.periodo
}

function presetActivo(p: typeof presets[number]) {
  return desde.value?.toString() === p.desde && hasta.value?.toString() === p.hasta && periodo.value === p.periodo
}

const filtros = computed<FiltrosReporte>(() => ({
  tiendaId: tienda.value === 'todas' ? undefined : tienda.value,
  periodo: periodo.value,
  desde: desde.value?.toString() ?? hoy,
  hasta: hasta.value?.toString() ?? hoy
}))
</script>

<template>
  <UDashboardPanel id="reportes">
    <template #header>
      <PanelNavbar title="Reportes" />
    </template>

    <template #body>
      <!-- En móvil, sin íconos y con menos relleno para que quepan las cuatro pestañas -->
      <UTabs
        v-model="reporte"
        :items="reportes"
        :content="false"
        variant="link"
        :ui="{ trigger: 'px-2 sm:px-3', leadingIcon: 'hidden sm:inline-flex' }"
      />

      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-1">
          <UButton
            v-for="p in presets"
            :key="p.label"
            :label="p.label"
            size="xs"
            :color="presetActivo(p) ? 'primary' : 'neutral'"
            :variant="presetActivo(p) ? 'solid' : 'outline'"
            @click="aplicarPreset(p)"
          />
        </div>
        <UFormField
          label="Desde"
          class="min-w-0 grow basis-36 sm:grow-0 sm:basis-auto"
        >
          <UInputDate
            v-model="desde"
            class="w-full sm:w-auto"
          />
        </UFormField>
        <UFormField
          label="Hasta"
          class="min-w-0 grow basis-36 sm:grow-0 sm:basis-auto"
        >
          <UInputDate
            v-model="hasta"
            class="w-full sm:w-auto"
          />
        </UFormField>
        <UFormField
          label="Agrupar por"
          class="min-w-0 grow basis-36 sm:grow-0 sm:basis-auto"
        >
          <UTabs
            v-model="periodo"
            :items="periodos"
            :content="false"
            size="xs"
          />
        </UFormField>
        <UFormField
          label="Tienda"
          class="min-w-0 grow basis-36 sm:grow-0 sm:basis-auto"
        >
          <USelect
            v-model="tienda"
            :items="tiendaItems"
            class="w-full sm:w-52"
          />
        </UFormField>
      </div>

      <ReporteVentas
        v-if="reporte === 'ventas'"
        :filtros="filtros"
      />
      <ReporteCompras
        v-else-if="reporte === 'compras'"
        :filtros="filtros"
      />
      <ReporteCortes
        v-else-if="reporte === 'cortes'"
        :filtros="filtros"
      />
      <ReporteResumen
        v-else
        :filtros="filtros"
      />
    </template>
  </UDashboardPanel>
</template>
