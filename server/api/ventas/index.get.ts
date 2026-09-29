import { and, count, desc, eq, sql } from 'drizzle-orm'
import { tienda, user, venta } from '~~/server/db/schema'

const querySchema = paginacionSchema.merge(ventasFiltrosSchema)

// Admin: todas (filtro opcional por tienda). Vendedora: solo sus ventas en su tienda activa.
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, validar(querySchema))
  const { sinEstado: filtros, where } = await condicionesVentas(event, query)
  const db = useDb()

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
