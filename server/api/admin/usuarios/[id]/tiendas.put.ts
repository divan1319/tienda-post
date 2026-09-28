import { z } from 'zod'
import { eq, inArray } from 'drizzle-orm'
import { tienda, user, usuarioTienda } from '~~/server/db/schema'

const paramsSchema = z.object({ id: z.string().min(1) })
const bodySchema = z.object({
  tiendaIds: z.array(z.number().int().positive()).max(100).transform(ids => [...new Set(ids)])
})

// Reemplaza las tiendas asignadas a un usuario.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, validar(paramsSchema))
  const { tiendaIds } = await readValidatedBody(event, validar(bodySchema))
  const db = useDb()

  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.id, id)).limit(1)
  if (!u) {
    throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado.' })
  }

  if (tiendaIds.length) {
    const existentes = await db.select({ id: tienda.id }).from(tienda).where(inArray(tienda.id, tiendaIds))
    if (existentes.length !== tiendaIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Alguna de las tiendas no existe.' })
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(usuarioTienda).where(eq(usuarioTienda.userId, id))
    if (tiendaIds.length) {
      await tx.insert(usuarioTienda).values(tiendaIds.map(tiendaId => ({ userId: id, tiendaId })))
    }
  })

  // Si la tienda activa ya no está asignada se limpia (o se fija si queda una sola)
  const { tiendaActivaId } = await sincronizarTiendaActiva(id)

  return { tiendaIds, tiendaActivaId }
})
