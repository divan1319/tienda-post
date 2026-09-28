import { z } from 'zod'
import { and, count, desc, eq, isNotNull, isNull, type SQL } from 'drizzle-orm'
import { tienda, turnoCaja, user } from '~~/server/db/schema'

const querySchema = paginacionSchema.extend({
  tiendaId: queryId,
  abiertos: z.enum(['true', 'false']).optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional()
})

// Admin: todos los turnos (filtros por tienda y abiertos). Vendedora: solo los suyos.
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const query = await getValidatedQuery(event, validar(querySchema))
  const db = useDb()

  const filtros: (SQL | undefined)[] = [
    isAdmin(session.user) ? undefined : eq(turnoCaja.userId, session.user.id),
    query.tiendaId ? eq(turnoCaja.tiendaId, query.tiendaId) : undefined,
    query.abiertos === 'true' ? isNull(turnoCaja.cerradoAt) : undefined,
    query.abiertos === 'false' ? isNotNull(turnoCaja.cerradoAt) : undefined,
    query.desde ? desdeFechaLocal(turnoCaja.abiertoAt, query.desde) : undefined,
    query.hasta ? hastaFechaLocal(turnoCaja.abiertoAt, query.hasta) : undefined
  ]
  const where = and(...filtros)

  const [items, [total]] = await Promise.all([
    db
      .select({
        id: turnoCaja.id,
        tiendaId: turnoCaja.tiendaId,
        tiendaNombre: tienda.nombre,
        userId: turnoCaja.userId,
        usuario: user.name,
        abiertoAt: turnoCaja.abiertoAt,
        cerradoAt: turnoCaja.cerradoAt,
        montoInicialCentavos: turnoCaja.montoInicialCentavos,
        efectivoEsperadoCentavos: turnoCaja.efectivoEsperadoCentavos,
        efectivoContadoCentavos: turnoCaja.efectivoContadoCentavos,
        diferenciaCentavos: turnoCaja.diferenciaCentavos
      })
      .from(turnoCaja)
      .innerJoin(tienda, eq(tienda.id, turnoCaja.tiendaId))
      .innerJoin(user, eq(user.id, turnoCaja.userId))
      .where(where)
      .orderBy(desc(turnoCaja.abiertoAt), desc(turnoCaja.id))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(turnoCaja).where(where)
  ])

  // Para los turnos abiertos se agrega el efectivo disponible (para elegir de cuál pagar)
  if (query.abiertos === 'true') {
    const conEsperado = await Promise.all(items.map(async (t) => {
      const [turno] = await db.select().from(turnoCaja).where(eq(turnoCaja.id, t.id)).limit(1)
      const { efectivoEsperadoCentavos } = await resumenTurno(db, turno!)
      return { ...t, efectivoDisponibleCentavos: efectivoEsperadoCentavos as number | null }
    }))
    return { total: total?.total ?? 0, items: conEsperado }
  }

  return { total: total?.total ?? 0, items: items.map(t => ({ ...t, efectivoDisponibleCentavos: null as number | null })) }
})
