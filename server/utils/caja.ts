import { and, asc, count, eq, isNull, sql } from 'drizzle-orm'
import { salidaCaja, turnoCaja, user, venta } from '../db/schema'
import type { Consultor, Tx } from './inventario'
import type { MetodoPago } from '../../shared/utils/ventas'

export type Turno = typeof turnoCaja.$inferSelect

/** Turno abierto del usuario en la tienda (o null). */
export async function turnoAbierto(q: Consultor, tiendaId: number, userId: string) {
  const [turno] = await q
    .select()
    .from(turnoCaja)
    .where(and(eq(turnoCaja.tiendaId, tiendaId), eq(turnoCaja.userId, userId), isNull(turnoCaja.cerradoAt)))
    .limit(1)
  return turno ?? null
}

/**
 * Bloquea el turno. `share` para registrar ventas (varias a la vez, pero el cierre espera);
 * `update` para cerrar, anular o registrar salidas (necesitan el esperado estable).
 */
export async function bloquearTurno(tx: Tx, turnoId: number, modo: 'share' | 'update') {
  const [turno] = await tx.select().from(turnoCaja).where(eq(turnoCaja.id, turnoId)).for(modo)
  return turno ?? null
}

/** Totales del turno: ventas completadas por método, salidas y efectivo esperado. */
export async function resumenTurno(q: Consultor, turno: Turno) {
  const [porMetodo, [anuladas], salidas] = await Promise.all([
    q
      .select({
        metodoPago: venta.metodoPago,
        ventas: count(),
        totalCentavos: sql<number>`coalesce(sum(${venta.totalCentavos}), 0)`.mapWith(Number)
      })
      .from(venta)
      .where(and(eq(venta.turnoId, turno.id), eq(venta.estado, 'completada')))
      .groupBy(venta.metodoPago),
    q
      .select({ ventas: count() })
      .from(venta)
      .where(and(eq(venta.turnoId, turno.id), eq(venta.estado, 'anulada'))),
    q
      .select({
        id: salidaCaja.id,
        montoCentavos: salidaCaja.montoCentavos,
        motivo: salidaCaja.motivo,
        usuario: user.name,
        createdAt: salidaCaja.createdAt
      })
      .from(salidaCaja)
      .innerJoin(user, eq(user.id, salidaCaja.userId))
      .where(eq(salidaCaja.turnoId, turno.id))
      .orderBy(asc(salidaCaja.createdAt))
  ])

  const metodo = (m: MetodoPago) => porMetodo.find(p => p.metodoPago === m) ?? { ventas: 0, totalCentavos: 0 }
  const ventasEfectivoCentavos = metodo('efectivo').totalCentavos
  const salidasCentavos = salidas.reduce((suma, s) => suma + s.montoCentavos, 0)

  return {
    porMetodo: METODOS_PAGO.map(m => ({ metodoPago: m, ...metodo(m) })),
    ventas: porMetodo.reduce((suma, p) => suma + p.ventas, 0),
    totalVendidoCentavos: porMetodo.reduce((suma, p) => suma + p.totalCentavos, 0),
    ventasAnuladas: anuladas?.ventas ?? 0,
    ventasEfectivoCentavos,
    salidas,
    salidasCentavos,
    efectivoEsperadoCentavos: efectivoEsperado({
      montoInicialCentavos: turno.montoInicialCentavos,
      ventasEfectivoCentavos,
      salidasCentavos
    })
  }
}

interface NuevaSalida {
  turnoId: number
  tiendaId: number
  userId: string
  montoCentavos: number
  motivo: string
  /** Compra que paga la salida: su monto debe ser igual al total de la compra */
  compra?: { id: number, totalCentavos: number }
}

/**
 * Registra una salida de efectivo. Debe llamarse dentro de una transacción.
 * El turno debe existir, pertenecer a la tienda indicada y estar abierto; el monto no
 * puede superar el esperado, que se recalcula con el turno bloqueado.
 */
export async function registrarSalida(tx: Tx, s: NuevaSalida) {
  const turno = await bloquearTurno(tx, s.turnoId, 'update')
  if (!turno) {
    throw createError({ statusCode: 404, statusMessage: 'Turno no encontrado.' })
  }
  if (turno.tiendaId !== s.tiendaId) {
    throw createError({ statusCode: 400, statusMessage: 'El turno no pertenece a la tienda indicada.' })
  }
  if (turno.cerradoAt) {
    throw createError({ statusCode: 409, statusMessage: 'El turno ya está cerrado.' })
  }

  if (s.compra && s.montoCentavos !== s.compra.totalCentavos) {
    throw createError({ statusCode: 400, statusMessage: 'El monto de la salida debe ser igual al total de la compra.' })
  }

  const { efectivoEsperadoCentavos } = await resumenTurno(tx, turno)
  const error = validarMontoSalida(s.montoCentavos, efectivoEsperadoCentavos)
  if (error) {
    throw createError({ statusCode: 400, statusMessage: error })
  }

  const [salida] = await tx
    .insert(salidaCaja)
    .values({
      turnoId: s.turnoId,
      tiendaId: s.tiendaId,
      userId: s.userId,
      montoCentavos: s.montoCentavos,
      motivo: s.motivo,
      compraId: s.compra?.id ?? null
    })
    .returning()

  return salida!
}
