import { z } from 'zod'

const bodySchema = z.object({
  tiendaId: z.number().int().positive(),
  montoCentavos: z.number().int().positive().max(100_000_000),
  motivo: z.string().trim().min(3, 'El motivo es obligatorio').max(500)
})

// Salida de efectivo suelta (gasto menor, etc.). Solo admin.
export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  return useDb().transaction(tx => registrarSalida(tx, {
    turnoId: id,
    tiendaId: body.tiendaId,
    userId: session.user.id,
    montoCentavos: body.montoCentavos,
    motivo: body.motivo
  }))
})
