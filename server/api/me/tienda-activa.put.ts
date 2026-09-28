import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { user } from '~~/server/db/schema'

const bodySchema = z.object({
  tiendaId: z.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { tiendaId } = await readValidatedBody(event, validar(bodySchema))

  if (!(await puedeUsarTienda(session.user, tiendaId))) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a esta tienda.' })
  }

  await useDb().update(user).set({ tiendaActivaId: tiendaId }).where(eq(user.id, session.user.id))

  return { tiendaActivaId: tiendaId }
})
