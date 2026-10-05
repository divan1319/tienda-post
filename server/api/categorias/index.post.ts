import { eq } from 'drizzle-orm'
import { categoria } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readValidatedBody(event, validar(categoriaSchema))
  const db = useDb()

  // El código se calcula aquí a partir del nombre; no se acepta del cliente
  const codigo = codigoDesdeNombre(body.nombre)
  if (!codigo) {
    throw createError({ statusCode: 400, statusMessage: 'El nombre debe tener al menos una letra o un número.' })
  }

  const [existente] = await db.select({ nombre: categoria.nombre }).from(categoria).where(eq(categoria.codigo, codigo)).limit(1)
  if (existente) {
    throw createError({ statusCode: 409, statusMessage: `Ya existe una categoría con el código «${codigo}» (${existente.nombre}).` })
  }

  try {
    const [creada] = await db.insert(categoria).values({ ...body, codigo }).returning()
    return creada
  } catch (err) {
    handleDbError(err)
  }
})
