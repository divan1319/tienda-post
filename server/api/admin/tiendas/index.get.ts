import { asc } from 'drizzle-orm'
import { tienda } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return useDb()
    .select({
      id: tienda.id,
      nombre: tienda.nombre,
      direccion: tienda.direccion,
      activa: tienda.activa,
      createdAt: tienda.createdAt
    })
    .from(tienda)
    .orderBy(asc(tienda.nombre))
})
