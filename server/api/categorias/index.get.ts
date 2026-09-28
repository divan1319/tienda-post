import { z } from 'zod'
import { asc, count, eq } from 'drizzle-orm'
import { categoria, producto } from '~~/server/db/schema'

const querySchema = z.object({
  incluirInactivas: z.enum(['true', 'false']).optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const todas = isAdmin(session.user) && query.incluirInactivas === 'true'

  return useDb()
    .select({
      id: categoria.id,
      nombre: categoria.nombre,
      activa: categoria.activa,
      productos: count(producto.id)
    })
    .from(categoria)
    .leftJoin(producto, eq(producto.categoriaId, categoria.id))
    .where(todas ? undefined : eq(categoria.activa, true))
    .groupBy(categoria.id)
    .orderBy(asc(categoria.nombre))
})
