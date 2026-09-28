import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { tienda, venta, ventaDetalle } from '~~/server/db/schema'
import type { UnidadMedida } from '~~/shared/utils/cantidad'

// El cliente envía solo productos, cantidades, método y monto recibido.
// Precios, totales, tienda y turno los resuelve el servidor.
const bodySchema = z.object({
  lineas: z.array(z.object({
    productoId: z.number().int().positive(),
    cantidad: cantidadSchema
  })).min(1, 'El carrito está vacío').max(200),
  metodoPago: z.enum(METODOS_PAGO),
  montoRecibidoCentavos: z.number().int().min(0).max(100_000_000).nullish()
})

export default defineEventHandler(async (event) => {
  const { session, tiendaId } = await requireTienda(event)
  const body = await readValidatedBody(event, validar(bodySchema))
  const db = useDb()

  const ventaId = await db.transaction(async (tx) => {
    // 1. Turno abierto del usuario; bloqueado en modo compartido para que no se cierre a la mitad
    const abierto = await turnoAbierto(tx, tiendaId, session.user.id)
    const turno = abierto && await bloquearTurno(tx, abierto.id, 'share')
    if (!turno || turno.cerradoAt) {
      throw createError({ statusCode: 409, statusMessage: 'No tienes un turno de caja abierto en esta tienda.', data: { code: 'SIN_TURNO' } })
    }

    // 2. Precios y unidad actuales desde la base; valida cantidades y calcula el total
    const productos = await validarLineas(body.lineas, tx)
    const lineas = body.lineas.map((l) => {
      const p = productos.get(l.productoId)!
      return {
        productoId: p.id,
        nombreProducto: p.nombre,
        unidadMedida: p.unidadMedida as UnidadMedida,
        precioUnitarioCentavos: p.precioVentaCentavos,
        cantidad: l.cantidad,
        subtotalCentavos: subtotalLinea(p.precioVentaCentavos, l.cantidad)
      }
    })
    const totalCentavos = totalVenta(lineas.map(l => l.subtotalCentavos))

    const cobro = calcularCobro(totalCentavos, body.metodoPago, body.montoRecibidoCentavos)
    if ('error' in cobro) {
      throw createError({ statusCode: 400, statusMessage: cobro.error })
    }

    // 3. Correlativo por tienda
    const [t] = await tx
      .update(tienda)
      .set({ ultimoCorrelativo: sql`${tienda.ultimoCorrelativo} + 1` })
      .where(eq(tienda.id, tiendaId))
      .returning({ correlativo: tienda.ultimoCorrelativo })

    // 4. Venta y detalle
    const [nueva] = await tx
      .insert(venta)
      .values({
        tiendaId,
        turnoId: turno.id,
        correlativo: t!.correlativo,
        userId: session.user.id,
        totalCentavos,
        metodoPago: body.metodoPago,
        montoRecibidoCentavos: cobro.montoRecibidoCentavos,
        cambioCentavos: cobro.cambioCentavos
      })
      .returning({ id: venta.id })

    await tx.insert(ventaDetalle).values(lineas.map(l => ({ ventaId: nueva!.id, ...l })))

    // 5. Descuento de stock (upsert atómico) y movimiento por línea. Se recorre por
    // productoId para bloquear las filas de stock siempre en el mismo orden (sin deadlocks)
    let stockInsuficiente = false
    for (const l of [...lineas].sort((a, b) => a.productoId - b.productoId)) {
      const saldo = await aplicarMovimiento(tx, {
        tiendaId,
        productoId: l.productoId,
        tipo: 'venta',
        cantidad: -l.cantidad,
        userId: session.user.id,
        referenciaTipo: 'venta',
        referenciaId: nueva!.id
      })
      if (saldo < 0) stockInsuficiente = true
    }

    if (stockInsuficiente) {
      await tx.update(venta).set({ conStockInsuficiente: true }).where(eq(venta.id, nueva!.id))
    }

    return nueva!.id
  })

  return obtenerVenta(db, ventaId)
})
