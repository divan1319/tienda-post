import { pedido } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const body = await readValidatedBody(event, validar(pedidoSchema))
  await requireTiendaActiva(session.user, body.tiendaId)

  const [nuevo] = await useDb()
    .insert(pedido)
    .values({ ...body, userId: session.user.id })
    .returning()
  return nuevo
})
