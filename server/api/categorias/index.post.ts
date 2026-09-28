import { categoria } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readValidatedBody(event, categoriaSchema.parse)

  try {
    const [creada] = await useDb().insert(categoria).values(body).returning()
    return creada
  } catch (err) {
    handleDbError(err)
  }
})
