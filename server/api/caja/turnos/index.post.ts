import { z } from 'zod'
import { turnoCaja } from '~~/server/db/schema'

const bodySchema = z.object({
  montoInicialCentavos: z.number().int().min(0).max(100_000_000)
})

// Abre un turno de caja en la tienda activa con el efectivo inicial.
export default defineEventHandler(async (event) => {
  const { session, tiendaId } = await requireTienda(event)
  const body = await readValidatedBody(event, validar(bodySchema))

  try {
    const [turno] = await useDb()
      .insert(turnoCaja)
      .values({ tiendaId, userId: session.user.id, montoInicialCentavos: body.montoInicialCentavos })
      .returning()
    return turno
  } catch (err) {
    const codigo = err as { code?: string, cause?: { code?: string } }
    if (codigo.code === '23505' || codigo.cause?.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Ya tienes un turno abierto en esta tienda.' })
    }
    handleDbError(err)
  }
})
