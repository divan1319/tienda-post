import { z } from 'zod'
import { and, eq, gte, lte, type SQL } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { compra, venta } from '../db/schema'

// Filtros compartidos por los listados y su exportación a CSV, para que el archivo
// tenga exactamente lo que se ve en pantalla.

export const ventasFiltrosSchema = z.object({
  tiendaId: queryId,
  turnoId: queryId,
  estado: z.enum(['completada', 'anulada']).optional(),
  metodoPago: z.enum(METODOS_PAGO).optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional()
})

/**
 * Condiciones de ventas. Admin: todas (tienda opcional). Vendedora: solo sus ventas
 * en su tienda activa. `sinEstado` excluye el filtro de estado (para los totales,
 * que siempre cuentan solo completadas).
 */
export async function condicionesVentas(event: H3Event, query: z.output<typeof ventasFiltrosSchema>) {
  const session = await requireUserSession(event)

  let filtroTienda: SQL | undefined
  let filtroUsuario: SQL | undefined
  if (isAdmin(session.user)) {
    filtroTienda = query.tiendaId ? eq(venta.tiendaId, query.tiendaId) : undefined
  } else {
    const { tiendaId } = await requireTienda(event)
    filtroTienda = eq(venta.tiendaId, tiendaId)
    filtroUsuario = eq(venta.userId, session.user.id)
  }

  const sinEstado = [
    filtroTienda,
    filtroUsuario,
    query.turnoId ? eq(venta.turnoId, query.turnoId) : undefined,
    query.metodoPago ? eq(venta.metodoPago, query.metodoPago) : undefined,
    query.desde ? desdeFechaLocal(venta.createdAt, query.desde) : undefined,
    query.hasta ? hastaFechaLocal(venta.createdAt, query.hasta) : undefined
  ]

  return {
    sinEstado,
    where: and(...sinEstado, query.estado ? eq(venta.estado, query.estado) : undefined)
  }
}

export const comprasFiltrosSchema = z.object({
  tiendaId: queryId,
  tipo: z.enum(['pedido', 'directa']).optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional()
})

/** Condiciones de compras (solo admin). `sinTipo` sirve para los totales del periodo. */
export function condicionesCompras(query: z.output<typeof comprasFiltrosSchema>) {
  // fecha_compra es una fecha local: se compara directo con desde/hasta
  const sinTipo = [
    query.tiendaId ? eq(compra.tiendaId, query.tiendaId) : undefined,
    query.desde ? gte(compra.fechaCompra, query.desde) : undefined,
    query.hasta ? lte(compra.fechaCompra, query.hasta) : undefined
  ]
  return {
    sinTipo,
    where: and(...sinTipo, query.tipo ? eq(compra.tipo, query.tipo) : undefined)
  }
}

/** Responde un CSV como archivo descargable. */
export function enviarCsv(event: H3Event, nombre: string, contenido: string) {
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${nombre}"`)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return contenido
}
