import { sql, type SQL, type AnyColumn } from 'drizzle-orm'
import { z } from 'zod'

export const ZONA_HORARIA = 'America/El_Salvador'

/** Fecha local `YYYY-MM-DD` (se interpreta en la zona horaria de El Salvador). */
export const fechaSchema = z.string().refine(esFechaValida, 'Fecha inválida (YYYY-MM-DD)')

/** columna >= inicio del día `desde` en hora local */
export function desdeFechaLocal(columna: AnyColumn | SQL, desde: string): SQL {
  return sql`${columna} >= (${desde}::date::timestamp AT TIME ZONE ${ZONA_HORARIA})`
}

/** columna < inicio del día siguiente a `hasta` en hora local (incluye todo `hasta`) */
export function hastaFechaLocal(columna: AnyColumn | SQL, hasta: string): SQL {
  return sql`${columna} < ((${hasta}::date + 1)::timestamp AT TIME ZONE ${ZONA_HORARIA})`
}
