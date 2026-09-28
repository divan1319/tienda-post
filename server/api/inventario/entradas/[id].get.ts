import { asc, eq } from 'drizzle-orm'
import { entradaInventario, entradaInventarioDetalle, producto, tienda, user } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const db = useDb()

  const [entrada] = await db
    .select({
      id: entradaInventario.id,
      tiendaNombre: tienda.nombre,
      usuario: user.name,
      nota: entradaInventario.nota,
      createdAt: entradaInventario.createdAt
    })
    .from(entradaInventario)
    .innerJoin(tienda, eq(tienda.id, entradaInventario.tiendaId))
    .innerJoin(user, eq(user.id, entradaInventario.userId))
    .where(eq(entradaInventario.id, id))
    .limit(1)

  if (!entrada) {
    throw createError({ statusCode: 404, statusMessage: 'Entrada no encontrada.' })
  }

  const lineas = await db
    .select({
      productoId: entradaInventarioDetalle.productoId,
      nombre: producto.nombre,
      unidadMedida: producto.unidadMedida,
      cantidad: entradaInventarioDetalle.cantidad
    })
    .from(entradaInventarioDetalle)
    .innerJoin(producto, eq(producto.id, entradaInventarioDetalle.productoId))
    .where(eq(entradaInventarioDetalle.entradaId, id))
    .orderBy(asc(producto.nombre))

  return { ...entrada, lineas }
})
