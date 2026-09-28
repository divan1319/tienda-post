import { eq, sql } from 'drizzle-orm'
import { movimientoInventario, producto } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const body = await readValidatedBody(event, productoSchema.parse)
  const db = useDb()

  const [actual] = await db.select({ unidadMedida: producto.unidadMedida }).from(producto).where(eq(producto.id, id)).limit(1)
  if (!actual) {
    throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado.' })
  }

  // Cambiar la unidad con movimientos registrados dejaría cantidades incoherentes
  if (body.unidadMedida !== actual.unidadMedida) {
    const [conMovimientos] = await db
      .select({ id: movimientoInventario.id })
      .from(movimientoInventario)
      .where(eq(movimientoInventario.productoId, id))
      .limit(1)
    if (conMovimientos) {
      throw createError({
        statusCode: 409,
        statusMessage: 'No se puede cambiar la unidad de medida de un producto con movimientos de inventario.'
      })
    }
  }

  try {
    const [actualizado] = await db
      .update(producto)
      .set({ ...body, updatedAt: sql`now()` })
      .where(eq(producto.id, id))
      .returning()
    return actualizado
  } catch (err) {
    handleDbError(err)
  }
})
