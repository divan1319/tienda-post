import { z } from 'zod'
import { and, asc, eq, or } from 'drizzle-orm'
import { producto, stockTienda, tienda } from '~~/server/db/schema'

const querySchema = z.object({
  // Admin: una tienda o todas. Vendedora: siempre su tienda activa.
  tiendaId: queryId
})

// Productos activos con stock bajo o por corregir.
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const query = await getValidatedQuery(event, validar(querySchema))

  let tiendaId = query.tiendaId
  if (!isAdmin(session.user)) {
    tiendaId = (await requireTienda(event)).tiendaId
  }

  const filas = await useDb()
    .select({
      tiendaId: stockTienda.tiendaId,
      tiendaNombre: tienda.nombre,
      productoId: producto.id,
      nombre: producto.nombre,
      unidadMedida: producto.unidadMedida,
      cantidad: stockTienda.cantidad,
      stockMinimo: stockTienda.stockMinimo
    })
    .from(stockTienda)
    .innerJoin(producto, eq(producto.id, stockTienda.productoId))
    .innerJoin(tienda, eq(tienda.id, stockTienda.tiendaId))
    .where(and(
      eq(producto.activo, true),
      eq(tienda.activa, true),
      tiendaId ? eq(stockTienda.tiendaId, tiendaId) : undefined,
      or(condicionStockBajo, condicionStockNegativo)
    ))
    .orderBy(asc(stockTienda.cantidad), asc(producto.nombre))
    .limit(500)

  return {
    porCorregir: filas.filter(f => f.cantidad < 0),
    bajo: filas.filter(f => f.cantidad >= 0)
  }
})
