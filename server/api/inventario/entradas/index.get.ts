import { count, desc, eq } from 'drizzle-orm'
import { entradaInventario, entradaInventarioDetalle, tienda, user } from '~~/server/db/schema'

const querySchema = paginacionSchema.extend({
  tiendaId: queryId
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, validar(querySchema))
  const db = useDb()
  const where = query.tiendaId ? eq(entradaInventario.tiendaId, query.tiendaId) : undefined

  const [items, [total]] = await Promise.all([
    db
      .select({
        id: entradaInventario.id,
        tiendaId: entradaInventario.tiendaId,
        tiendaNombre: tienda.nombre,
        usuario: user.name,
        nota: entradaInventario.nota,
        createdAt: entradaInventario.createdAt,
        lineas: count(entradaInventarioDetalle.productoId)
      })
      .from(entradaInventario)
      .innerJoin(tienda, eq(tienda.id, entradaInventario.tiendaId))
      .innerJoin(user, eq(user.id, entradaInventario.userId))
      .leftJoin(entradaInventarioDetalle, eq(entradaInventarioDetalle.entradaId, entradaInventario.id))
      .where(where)
      .groupBy(entradaInventario.id, tienda.nombre, user.name)
      .orderBy(desc(entradaInventario.createdAt), desc(entradaInventario.id))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(entradaInventario).where(where)
  ])

  return { total: total?.total ?? 0, items }
})
