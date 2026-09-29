import { z } from 'zod'
import { sql, type SQL, type AnyColumn } from 'drizzle-orm'
import type { H3Event } from 'h3'

export const reporteQuerySchema = z.object({
  tiendaId: queryId,
  periodo: z.enum(PERIODOS).default('dia'),
  desde: fechaSchema,
  hasta: fechaSchema
}).refine(q => q.desde <= q.hasta, 'La fecha inicial no puede ser posterior a la final')

/** Valida la consulta común de los reportes y devuelve los periodos a mostrar. */
export async function leerReporteQuery(event: H3Event) {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, validar(reporteQuerySchema))
  const max = MAX_PERIODOS[query.periodo]
  const periodos = generarPeriodos(query.periodo, query.desde, query.hasta, max)
  if (periodos.length > max) {
    throw createError({
      statusCode: 400,
      statusMessage: `El rango es demasiado largo para agrupar por ${query.periodo === 'dia' ? 'día' : query.periodo === 'mes' ? 'mes' : 'año'}; elige un periodo más amplio.`
    })
  }
  return { ...query, periodos }
}

// La unidad y la zona son literales de una lista cerrada (nunca vienen del cliente
// sin validar); van en el SQL para que GROUP BY coincida con el SELECT.
function unidad(periodo: Periodo) {
  return sql.raw(`'${UNIDAD_SQL[periodo]}'`)
}

/** Inicio del periodo (`YYYY-MM-DD`) de un timestamptz, en hora de El Salvador. */
export function periodoDeTimestamp(columna: AnyColumn | SQL, periodo: Periodo): SQL<string> {
  return sql<string>`to_char(date_trunc(${unidad(periodo)}, ${columna} AT TIME ZONE 'America/El_Salvador'), 'YYYY-MM-DD')`
}

/** Inicio del periodo (`YYYY-MM-DD`) de una columna date (ya es fecha local). */
export function periodoDeFecha(columna: AnyColumn | SQL, periodo: Periodo): SQL<string> {
  return sql<string>`to_char(date_trunc(${unidad(periodo)}, ${columna}::timestamp), 'YYYY-MM-DD')`
}

/** Suma de centavos como number (sum de integer en Postgres devuelve bigint/texto). */
export function sumaCentavos(expr: AnyColumn | SQL, filtro?: SQL): SQL<number> {
  return (filtro
    ? sql<number>`coalesce(sum(${expr}) filter (where ${filtro}), 0)`
    : sql<number>`coalesce(sum(${expr}), 0)`
  ).mapWith(Number)
}
