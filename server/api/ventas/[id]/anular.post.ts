import { z } from 'zod'
import { asc, eq, sql } from 'drizzle-orm'
import { venta, ventaDetalle } from '~~/server/db/schema'

const bodySchema = z.object({
  motivo: z.string().trim().min(3, 'El motivo es obligatorio').max(500)
})

// Anula la venta (no se borra), devuelve el stock y escribe movimientos anulacion_venta.
export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb()

  await db.transaction(async (tx) => {
    const [actual] = await tx.select({ turnoId: venta.turnoId }).from(venta).where(eq(venta.id, id)).limit(1)
    if (!actual) {
      throw createError({ statusCode: 404, statusMessage: 'Venta no encontrada.' })
    }

    // Mismo orden de bloqueo que ventas y salidas (turno y luego venta): la anulación
    // cambia el efectivo esperado del turno
    await bloquearTurno(tx, actual.turnoId, 'update')
    const [v] = await tx.select().from(venta).where(eq(venta.id, id)).for('update')
    if (v!.estado === 'anulada') {
      throw createError({ statusCode: 409, statusMessage: 'La venta ya está anulada.' })
    }

    await tx
      .update(venta)
      .set({
        estado: 'anulada',
        anuladaPor: session.user.id,
        anuladaAt: sql`now()`,
        motivoAnulacion: body.motivo
      })
      .where(eq(venta.id, id))

    // Por productoId: mismo orden de bloqueo de stock que las ventas
    const detalle = await tx.select().from(ventaDetalle).where(eq(ventaDetalle.ventaId, id)).orderBy(asc(ventaDetalle.productoId))
    for (const l of detalle) {
      await aplicarMovimiento(tx, {
        tiendaId: v!.tiendaId,
        productoId: l.productoId,
        tipo: 'anulacion_venta',
        cantidad: l.cantidad,
        userId: session.user.id,
        referenciaTipo: 'venta',
        referenciaId: id,
        nota: body.motivo
      })
    }
  })

  return obtenerVenta(db, id)
})
