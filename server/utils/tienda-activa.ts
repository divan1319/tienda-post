import { eq } from 'drizzle-orm'
import { user } from '../db/schema'

/**
 * Revisa la tienda activa guardada del usuario contra sus tiendas disponibles:
 * - si ya no tiene acceso a ella, se limpia;
 * - si no tiene tienda activa y solo hay una disponible, se fija automáticamente.
 */
export async function sincronizarTiendaActiva(userId: string) {
  const db = useDb()
  const [u] = await db
    .select({ id: user.id, role: user.role, tiendaActivaId: user.tiendaActivaId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!u) {
    throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado.' })
  }

  const tiendas = await tiendasDelUsuario(u)
  let tiendaActivaId = u.tiendaActivaId

  if (tiendaActivaId && !tiendas.some(t => t.id === tiendaActivaId)) {
    tiendaActivaId = null
  }
  if (!tiendaActivaId && tiendas.length === 1) {
    tiendaActivaId = tiendas[0]!.id
  }

  if (tiendaActivaId !== u.tiendaActivaId) {
    await db.update(user).set({ tiendaActivaId }).where(eq(user.id, u.id))
  }

  return { tiendas, tiendaActivaId }
}
