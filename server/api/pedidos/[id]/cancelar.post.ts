import { and, eq } from 'drizzle-orm'
import { pedido } from '~~/server/db/schema'

// Cancela un pedido pendiente (no genera compra).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)

  const [cancelado] = await useDb()
    .update(pedido)
    .set({ estado: 'cancelado' })
    .where(and(eq(pedido.id, id), eq(pedido.estado, 'pendiente')))
    .returning()

  if (!cancelado) {
    throw createError({ statusCode: 409, statusMessage: 'Solo se pueden cancelar pedidos pendientes.' })
  }
  return cancelado
})
