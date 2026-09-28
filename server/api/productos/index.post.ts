import { producto } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readValidatedBody(event, productoSchema.parse)

  try {
    const [creado] = await useDb().insert(producto).values(body).returning()
    return creado
  } catch (err) {
    handleDbError(err)
  }
})
