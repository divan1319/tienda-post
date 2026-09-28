import { z } from 'zod'
import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm'
import { tienda, user, venta } from '~~/server/db/schema'

const querySchema = paginacionSchema.extend({
  tiendaId: queryId,
  turnoId: queryId,
  estado: z.enum(['completada', 'anulada']).optional(),
  metodoPago: z.enum(METODOS_PAGO).optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional()
})

// Admin: todas (filtro opcional por tienda). Vendedora: solo sus ventas en su tienda activa.
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const db = useDb()

  let filtroTienda: SQL | undefined
  let filtroUsuario: SQL | undefined
  if (isAdmin(session.user)) {
    filtroTienda = query.tiendaId ? eq(venta.tiendaId, query.tiendaId) : undefined
  } else {
    const { tiendaId } = await requireTienda(event)
    filtroTienda = eq(venta.tiendaId, tiendaId)
    filtroUsuario = eq(venta.userId, session.user.id)
  }

  const filtros = [
    filtroTienda,
    filtroUsuario,
    query.turnoId ? eq(venta.turnoId, query.turnoId) : undefined,
    query.metodoPago ? eq(venta.metodoPago, query.metodoPago) : undefined,
    query.desde ? desdeFechaLocal(venta.createdAt, query.desde) : undefined,
    query.hasta ? hastaFechaLocal(venta.createdAt, query.hasta) : undefined
  ]
  const where = and(...filtros, query.estado ? eq(venta.estado, query.estado) : undefined)

  const [items, [total], [resumen]] = await Promise.all([
    db
      .select({
        id: venta.id,
        tiendaId: venta.tiendaId,
        tiendaNombre: tienda.nombre,
        correlativo: venta.correlativo,
        vendedor: user.name,
        totalCentavos: venta.totalCentavos,
        metodoPago: venta.metodoPago,
        estado: venta.estado,
        conStockInsuficiente: venta.conStockInsuficiente,
        createdAt: venta.createdAt
      })
      .from(venta)
      .innerJoin(tienda, eq(tienda.id, venta.tiendaId))
      .innerJoin(user, eq(user.id, venta.userId))
      .where(where)
      .orderBy(desc(venta.createdAt), desc(venta.id))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(venta).where(where),
    // Resumen de las ventas completadas con los mismos filtros (las anuladas no suman)
    db
      .select({
        ventas: count(),
        totalCentavos: sql<number>`coalesce(sum(${venta.totalCentavos}), 0)`.mapWith(Number)
      })
      .from(venta)
      .where(and(...filtros, eq(venta.estado, 'completada')))
  ])

  return {
    total: total?.total ?? 0,
    resumen: { ventas: resumen?.ventas ?? 0, totalCentavos: resumen?.totalCentavos ?? 0 },
    items
  }
})
