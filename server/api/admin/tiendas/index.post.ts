import { tienda } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readValidatedBody(event, validar(tiendaSchema))

  try {
    const [creada] = await useDb().insert(tienda).values(body).returning()
    return creada
  } catch (err) {
    handleDbError(err)
  }
})
