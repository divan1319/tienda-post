// Agrupación de reportes por día, mes o año (fechas locales de El Salvador, `YYYY-MM-DD`).

export const PERIODOS = ['dia', 'mes', 'anio'] as const
export type Periodo = typeof PERIODOS[number]

/** Unidad de date_trunc de Postgres para cada periodo (lista cerrada: se usa en SQL). */
export const UNIDAD_SQL: Record<Periodo, 'day' | 'month' | 'year'> = {
  dia: 'day',
  mes: 'month',
  anio: 'year'
}

/** Máximo de periodos por reporte, para que un rango largo no se agrupe por día. */
export const MAX_PERIODOS: Record<Periodo, number> = {
  dia: 400,
  mes: 240,
  anio: 50
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function aFechaUTC(fecha: string) {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a!, m! - 1, d!))
}

function aTexto(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Inicio del periodo que contiene la fecha (igual que date_trunc). */
export function inicioPeriodo(fecha: string, periodo: Periodo): string {
  if (periodo === 'dia') return fecha
  if (periodo === 'mes') return `${fecha.slice(0, 7)}-01`
  return `${fecha.slice(0, 4)}-01-01`
}

/**
 * Inicios de todos los periodos entre `desde` y `hasta` (ambos incluidos), en orden.
 * Sirve para rellenar con cero los periodos sin movimiento.
 */
export function generarPeriodos(periodo: Periodo, desde: string, hasta: string, max = Infinity): string[] {
  const resultado: string[] = []
  const fin = aFechaUTC(hasta)
  const d = aFechaUTC(inicioPeriodo(desde, periodo))
  while (d <= fin) {
    resultado.push(aTexto(d))
    if (resultado.length > max) break
    if (periodo === 'dia') d.setUTCDate(d.getUTCDate() + 1)
    else if (periodo === 'mes') d.setUTCMonth(d.getUTCMonth() + 1)
    else d.setUTCFullYear(d.getUTCFullYear() + 1)
  }
  return resultado
}

/**
 * Serie completa: un elemento por periodo, con los valores de `filas` o cero.
 * `filas` trae `periodo` (inicio, `YYYY-MM-DD`) y los campos numéricos indicados.
 */
export function rellenarSerie<C extends string>(
  periodos: string[],
  filas: ({ periodo: string } & Partial<Record<C, number>>)[],
  campos: readonly C[]
): ({ periodo: string } & Record<C, number>)[] {
  const porPeriodo = new Map(filas.map(f => [f.periodo, f]))
  return periodos.map((periodo) => {
    const fila = porPeriodo.get(periodo)
    const valores = Object.fromEntries(campos.map(c => [c, Number(fila?.[c] ?? 0)])) as Record<C, number>
    return { periodo, ...valores }
  })
}

/** Ticket promedio en centavos (redondeado); 0 si no hay ventas. */
export function ticketPromedio(totalCentavos: number, ventas: number): number {
  return ventas > 0 ? Math.round(totalCentavos / ventas) : 0
}

/** Etiqueta corta del periodo: 28/09 · sep 2026 · 2026 */
export function formatPeriodo(inicio: string, periodo: Periodo): string {
  const [a, m, d] = inicio.split('-')
  if (periodo === 'dia') return `${d}/${m}`
  if (periodo === 'mes') return `${MESES_CORTOS[Number(m) - 1]} ${a}`
  return a!
}
