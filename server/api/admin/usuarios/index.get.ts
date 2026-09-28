import { asc } from 'drizzle-orm'
import { user, usuarioTienda } from '~~/server/db/schema'

// Usuarios con sus tiendas asignadas (la gestión de cuentas usa el plugin admin de Better Auth).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()

  const [usuarios, asignaciones] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        tiendaActivaId: user.tiendaActivaId,
        createdAt: user.createdAt
      })
      .from(user)
      .orderBy(asc(user.name)),
    db.select().from(usuarioTienda)
  ])

  return usuarios.map(u => ({
    ...u,
    tiendaIds: asignaciones.filter(a => a.userId === u.id).map(a => a.tiendaId)
  }))
})
