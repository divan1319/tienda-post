import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { producto, stockTienda } from '~~/server/db/schema'
import type { UnidadMedida } from '~~/shared/utils/cantidad'

const bodySchema = z.object({
  tiendaId: z.number().int().positive(),
  productoId: z.number().int().positive(),
  // null quita el mínimo (el producto deja de marcarse como stock bajo)
  stockMinimo: z.number().finite().nullable()
})

// Define el stock mínimo de un producto en una tienda.
export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const body = await readValidatedBody(event, validar(bodySchema))
  await requireTiendaActiva(session.user, body.tiendaId)

  const [p] = await useDb()
    .select({ unidadMedida: producto.unidadMedida })
    .from(producto)
    .where(eq(producto.id, body.productoId))
    .limit(1)
  if (!p) {
    throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado.' })
  }

  if (body.stockMinimo !== null) {
    const error = validarCantidad(body.stockMinimo, p.unidadMedida as UnidadMedida, { permitirCero: true })
    if (error) throw createError({ statusCode: 400, statusMessage: error })
  }

  // Si la tienda aún no tiene fila de stock para el producto, se crea en 0
  const [fila] = await useDb()
    .insert(stockTienda)
    .values({ tiendaId: body.tiendaId, productoId: body.productoId, cantidad: 0, stockMinimo: body.stockMinimo })
    .onConflictDoUpdate({
      target: [stockTienda.tiendaId, stockTienda.productoId],
      set: { stockMinimo: body.stockMinimo }
    })
    .returning({ cantidad: stockTienda.cantidad, stockMinimo: stockTienda.stockMinimo })

  return fila
})
