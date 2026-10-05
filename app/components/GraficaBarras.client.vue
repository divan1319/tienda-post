<script setup lang="ts">
// Columnas por periodo con @unovis/vue. Solo en el cliente (las gráficas no se
// renderizan en SSR); la tabla equivalente la muestra GraficaCard.
import { VisAxis, VisBulletLegend, VisGroupedBar, VisStackedBar, VisTooltip, VisXYContainer } from '@unovis/vue'
import { GroupedBar, StackedBar } from '@unovis/ts'

export interface SerieGrafica {
  clave: string
  nombre: string
  /** Rol de color de la paleta validada (assets/css/graficas.css) */
  color: 'var(--serie-1)' | 'var(--serie-2)'
}

type Fila = Record<string, number | string>

const props = withDefaults(defineProps<{
  datos: Fila[]
  etiquetas: string[]
  series: SerieGrafica[]
  apilada?: boolean
  altura?: number
  formato?: (valor: number) => string
  descripcion: string
}>(), {
  apilada: false,
  altura: 260,
  formato: (valor: number) => formatUSD(valor)
})

const x = (_: Fila, i: number) => i
const ys = computed(() => props.series.map(s => (d: Fila) => Number(d[s.clave] ?? 0)))
const color = (_: Fila, i: number) => props.series[i]?.color ?? 'var(--serie-1)'

// Ancho disponible: en pantallas angostas caben menos etiquetas en el eje X
const contenedor = useTemplateRef('contenedor')
const ancho = ref(0)
let observador: ResizeObserver | undefined
onMounted(() => {
  if (!contenedor.value) return
  observador = new ResizeObserver(([entrada]) => {
    ancho.value = entrada?.contentRect.width ?? 0
  })
  observador.observe(contenedor.value)
})
onBeforeUnmount(() => observador?.disconnect())

// Como mucho ~10 etiquetas en el eje X (una cada ~64 px) para que no se encimen
const maxEtiquetas = computed(() => ancho.value ? Math.min(10, Math.max(2, Math.floor(ancho.value / 64))) : 10)
const tickValues = computed(() => {
  const n = props.etiquetas.length
  const paso = Math.max(1, Math.ceil(n / maxEtiquetas.value))
  return Array.from({ length: n }, (_, i) => i).filter(i => i % paso === 0)
})
const tickX = (i: number | Date) => props.etiquetas[Number(i)] ?? ''
const tickY = (v: number | Date) => props.formato(Number(v))

const leyenda = computed(() => props.series.map(s => ({ name: s.nombre, color: s.color })))

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!)
}

// Un tooltip con todas las series del periodo: el valor manda, el nombre acompaña
function tooltip(d: Fila) {
  const titulo = escapar(String(d._etiqueta ?? ''))
  const filas = props.series.map(s => `
    <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
      <span style="display:flex;align-items:center;gap:6px;color:var(--ui-text-muted)">
        <span style="display:inline-block;width:12px;height:2px;background:${s.color}"></span>${escapar(s.nombre)}
      </span>
      <strong style="font-family:var(--font-mono);color:var(--ui-text-highlighted)">${escapar(props.formato(Number(d[s.clave] ?? 0)))}</strong>
    </div>`).join('')
  return `<div style="min-width:160px;font-size:12px"><div style="margin-bottom:4px;color:var(--ui-text-muted)">${titulo}</div>${filas}</div>`
}

const triggers = computed(() => ({
  [props.apilada ? StackedBar.selectors.bar : GroupedBar.selectors.bar]: tooltip
}))
</script>

<template>
  <div
    ref="contenedor"
    class="space-y-2"
  >
    <VisBulletLegend
      v-if="series.length > 1"
      :items="leyenda"
    />
    <VisXYContainer
      :data="datos"
      :height="altura"
      :y-domain="[0, undefined]"
      :aria-label="descripcion"
      :padding="{ top: 8 }"
    >
      <VisStackedBar
        v-if="apilada"
        :x="x"
        :y="ys"
        :color="color"
        :bar-max-width="24"
        :rounded-corners="4"
      />
      <VisGroupedBar
        v-else
        :x="x"
        :y="ys"
        :color="color"
        :group-max-width="series.length * 24 + (series.length - 1) * 2"
        :bar-padding="0.08"
        :bar-min-height="0"
        :rounded-corners="4"
      />
      <VisAxis
        type="x"
        :tick-format="tickX"
        :tick-values="tickValues"
        :grid-line="false"
        :tick-line="false"
      />
      <VisAxis
        type="y"
        :tick-format="tickY"
        :num-ticks="5"
        :tick-line="false"
        :domain-line="false"
      />
      <VisTooltip :triggers="triggers" />
    </VisXYContainer>
  </div>
</template>
