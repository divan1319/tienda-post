import { and, eq } from 'drizzle-orm'
import { pedido } from '~~/server/db/schema'

// Edita un pedido pendiente.
export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, validar(idParamSchema))
  const body = await readValidatedBody(event, validar(pedidoSchema))
  await requireTiendaActiva(session.user, body.tiendaId)

  const [actualizado] = await useDb()
    .update(pedido)
    .set(body)
    .where(and(eq(pedido.id, id), eq(pedido.estado, 'pendiente')))
    .returning()

  if (!actualizado) {
    throw createError({ statusCode: 409, statusMessage: 'Solo se pueden editar pedidos pendientes.' })
  }
  return actualizado
})
