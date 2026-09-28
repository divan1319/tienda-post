import { z } from 'zod'
import { and, asc, count, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import { categoria, producto, stockTienda } from '~~/server/db/schema'

const querySchema = paginacionSchema.extend({
  q: z.string().trim().max(100).optional(),
  // Número de categoría o `sin` para los productos sin categoría
  categoriaId: z.union([z.literal('sin'), z.coerce.number().int().positive()]).optional(),
  // Solo el admin puede consultar otra tienda distinta de su tienda activa
  tiendaId: queryId,
  incluirInactivos: z.enum(['true', 'false']).optional()
})

// Búsqueda por nombre, código o categoría, con el stock de la tienda.
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, querySchema.parse)
  const { session, tiendaId } = await requireTienda(event, { tiendaId: query.tiendaId })
  const db = useDb()

  const filtros: (SQL | undefined)[] = []

  if (!(isAdmin(session.user) && query.incluirInactivos === 'true')) {
    filtros.push(eq(producto.activo, true))
  }
  if (query.q) {
    const patron = `%${query.q.replace(/[\\%_]/g, c => `\\${c}`)}%`
    filtros.push(or(ilike(producto.nombre, patron), eq(producto.codigoBarras, query.q)))
  }
  if (query.categoriaId === 'sin') {
    filtros.push(isNull(producto.categoriaId))
  } else if (query.categoriaId) {
    filtros.push(eq(producto.categoriaId, query.categoriaId))
  }

  const where = and(...filtros)
  const stockDeTienda = and(eq(stockTienda.productoId, producto.id), eq(stockTienda.tiendaId, tiendaId))

  const [items, [total]] = await Promise.all([
    db
      .select({
        id: producto.id,
        nombre: producto.nombre,
        codigoBarras: producto.codigoBarras,
        categoriaId: producto.categoriaId,
        categoriaNombre: categoria.nombre,
        unidadMedida: producto.unidadMedida,
        precioVentaCentavos: producto.precioVentaCentavos,
        fotoKey: producto.fotoKey,
        activo: producto.activo,
        stock: sql<number>`coalesce(${stockTienda.cantidad}, 0)`.mapWith(Number),
        stockMinimo: stockTienda.stockMinimo
      })
      .from(producto)
      .leftJoin(categoria, eq(categoria.id, producto.categoriaId))
      .leftJoin(stockTienda, stockDeTienda)
      .where(where)
      .orderBy(asc(producto.nombre), asc(producto.id))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(producto).where(where)
  ])

  return { tiendaId, total: total?.total ?? 0, items }
})
