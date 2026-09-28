import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { turnoCaja } from '~~/server/db/schema'

const bodySchema = z.object({
  efectivoContadoCentavos: z.number().int().min(0).max(100_000_000),
  nota: z.string().trim().max(500).nullish().transform(v => v || null)
})

// Cierra el turno propio: calcula el esperado, guarda contado y diferencia.
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { id } = await getValidatedRouterParams(event, validar(idParamSchema))
  const body = await readValidatedBody(event, validar(bodySchema))

  return useDb().transaction(async (tx) => {
    // Con el turno bloqueado, ninguna venta o salida puede entrar mientras se calcula
    const turno = await bloquearTurno(tx, id, 'update')
    if (!turno || turno.userId !== session.user.id) {
      throw createError({ statusCode: 404, statusMessage: 'Turno no encontrado.' })
    }
    if (turno.cerradoAt) {
      throw createError({ statusCode: 409, statusMessage: 'El turno ya está cerrado.' })
    }

    const resumen = await resumenTurno(tx, turno)
    const [cerrado] = await tx
      .update(turnoCaja)
      .set({
        cerradoAt: sql`now()`,
        efectivoEsperadoCentavos: resumen.efectivoEsperadoCentavos,
        efectivoContadoCentavos: body.efectivoContadoCentavos,
        diferenciaCentavos: body.efectivoContadoCentavos - resumen.efectivoEsperadoCentavos,
        nota: body.nota
      })
      .where(eq(turnoCaja.id, id))
      .returning()

    return { ...cerrado!, resumen }
  })
})
