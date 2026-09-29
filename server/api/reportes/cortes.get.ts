import { and, asc, eq, sql } from 'drizzle-orm'
import { tienda, turnoCaja, user } from '~~/server/db/schema'

// Turnos por tienda y usuario: efectivo inicial, ventas en efectivo, salidas,
// esperado, contado y diferencia. Se filtran por la fecha de apertura.
export default defineEventHandler(async (event) => {
  const q = await leerReporteQuery(event)

  const ventasEfectivo = sql<number>`(
    select coalesce(sum(v.total_centavos), 0) from venta v
    where v.turno_id = ${turnoCaja.id} and v.estado = 'completada' and v.metodo_pago = 'efectivo'
  )`.mapWith(Number)
  const salidas = sql<number>`(
    select coalesce(sum(s.monto_centavos), 0) from salida_caja s where s.turno_id = ${turnoCaja.id}
  )`.mapWith(Number)

  const filas = await useDb()
    .select({
      id: turnoCaja.id,
      tiendaNombre: tienda.nombre,
      usuario: user.name,
      abiertoAt: turnoCaja.abiertoAt,
      cerradoAt: turnoCaja.cerradoAt,
      montoInicialCentavos: turnoCaja.montoInicialCentavos,
      ventasEfectivoCentavos: ventasEfectivo,
      salidasCentavos: salidas,
      esperadoGuardadoCentavos: turnoCaja.efectivoEsperadoCentavos,
      efectivoContadoCentavos: turnoCaja.efectivoContadoCentavos,
      diferenciaCentavos: turnoCaja.diferenciaCentavos
    })
    .from(turnoCaja)
    .innerJoin(tienda, eq(tienda.id, turnoCaja.tiendaId))
    .innerJoin(user, eq(user.id, turnoCaja.userId))
    .where(and(
      q.tiendaId ? eq(turnoCaja.tiendaId, q.tiendaId) : undefined,
      desdeFechaLocal(turnoCaja.abiertoAt, q.desde),
      hastaFechaLocal(turnoCaja.abiertoAt, q.hasta)
    ))
    .orderBy(asc(turnoCaja.abiertoAt), asc(turnoCaja.id))
    .limit(2000)

  const turnos = filas.map((t) => {
    const esperadoActual = efectivoEsperado({
      montoInicialCentavos: t.montoInicialCentavos,
      ventasEfectivoCentavos: t.ventasEfectivoCentavos,
      salidasCentavos: t.salidasCentavos
    })
    return {
      ...t,
      abierto: !t.cerradoAt,
      // Cerrado: el esperado guardado al cerrar. Abierto: el de este momento.
      efectivoEsperadoCentavos: t.esperadoGuardadoCentavos ?? esperadoActual,
      // Una venta en efectivo anulada después del cierre cambia el cálculo actual
      cambioDespuesDelCierre: t.esperadoGuardadoCentavos !== null && t.esperadoGuardadoCentavos !== esperadoActual
    }
  })

  const cerrados = turnos.filter(t => !t.abierto)
  const diferencias = cerrados.map(t => t.diferenciaCentavos ?? 0)

  return {
    periodo: q.periodo,
    totales: {
      turnos: turnos.length,
      cerrados: cerrados.length,
      faltantesCentavos: diferencias.filter(d => d < 0).reduce((s, d) => s + d, 0),
      sobrantesCentavos: diferencias.filter(d => d > 0).reduce((s, d) => s + d, 0),
      diferenciaNetaCentavos: diferencias.reduce((s, d) => s + d, 0)
    },
    turnos
  }
})
