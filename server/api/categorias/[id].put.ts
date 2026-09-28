import { eq } from 'drizzle-orm'
import { categoria } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, validar(idParamSchema))
  const body = await readValidatedBody(event, validar(categoriaSchema))

  try {
    const [actualizada] = await useDb().update(categoria).set(body).where(eq(categoria.id, id)).returning()
    if (!actualizada) {
      throw createError({ statusCode: 404, statusMessage: 'Categoría no encontrada.' })
    }
    return actualizada
  } catch (err) {
    handleDbError(err)
  }
})
