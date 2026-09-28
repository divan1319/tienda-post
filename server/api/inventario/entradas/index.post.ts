import { z } from 'zod'
import { entradaInventario, entradaInventarioDetalle } from '~~/server/db/schema'

const bodySchema = z.object({
  tiendaId: z.number().int().positive(),
  nota: z.string().trim().max(500).nullish().transform(v => v || null),
  lineas: z.array(z.object({
    productoId: z.number().int().positive(),
    cantidad: cantidadSchema
  })).min(1, 'Agrega al menos un producto').max(500)
})

// Registra una entrada: crea la entrada, suma el stock y escribe un movimiento por línea.
export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  await requireTiendaActiva(session.user, body.tiendaId)
  await validarLineas(body.lineas)

  return useDb().transaction(async (tx) => {
    const [entrada] = await tx
      .insert(entradaInventario)
      .values({ tiendaId: body.tiendaId, userId: session.user.id, nota: body.nota })
      .returning({ id: entradaInventario.id })

    await tx.insert(entradaInventarioDetalle).values(body.lineas.map(l => ({
      entradaId: entrada!.id,
      productoId: l.productoId,
      cantidad: l.cantidad
    })))

    // Por productoId: mismo orden de bloqueo de stock que las ventas (sin deadlocks)
    for (const linea of [...body.lineas].sort((a, b) => a.productoId - b.productoId)) {
      await aplicarMovimiento(tx, {
        tiendaId: body.tiendaId,
        productoId: linea.productoId,
        tipo: 'entrada',
        cantidad: linea.cantidad,
        userId: session.user.id,
        referenciaTipo: 'entrada',
        referenciaId: entrada!.id,
        nota: body.nota
      })
    }

    return { id: entrada!.id }
  })
})
