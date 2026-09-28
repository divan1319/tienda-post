import { eq } from 'drizzle-orm'
import { tienda, turnoCaja, user } from '~~/server/db/schema'

// Detalle de un turno con su resumen (para verlo o imprimir el corte).
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const db = useDb()

  const [fila] = await db
    .select({ turno: turnoCaja, tiendaNombre: tienda.nombre, usuario: user.name })
    .from(turnoCaja)
    .innerJoin(tienda, eq(tienda.id, turnoCaja.tiendaId))
    .innerJoin(user, eq(user.id, turnoCaja.userId))
    .where(eq(turnoCaja.id, id))
    .limit(1)

  if (!fila || (!isAdmin(session.user) && fila.turno.userId !== session.user.id)) {
    throw createError({ statusCode: 404, statusMessage: 'Turno no encontrado.' })
  }

  return {
    ...fila.turno,
    tiendaNombre: fila.tiendaNombre,
    usuario: fila.usuario,
    resumen: await resumenTurno(db, fila.turno)
  }
})
