import { eq } from 'drizzle-orm'
import { tienda } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const body = await readValidatedBody(event, tiendaSchema.parse)

  try {
    const [actualizada] = await useDb().update(tienda).set(body).where(eq(tienda.id, id)).returning()
    if (!actualizada) {
      throw createError({ statusCode: 404, statusMessage: 'Tienda no encontrada.' })
    }
    return actualizada
  } catch (err) {
    handleDbError(err)
  }
})
