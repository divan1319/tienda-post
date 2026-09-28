import { eq } from 'drizzle-orm'
import { pedido } from '~~/server/db/schema'

// Recibe el pedido: crea la compra (tipo pedido) y lo marca recibido; con turnoId,
// también la salida de caja que la paga. Todo en una transacción.
export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, validar(idParamSchema))
  const body = await readValidatedBody(event, validar(datosCompraSchema))

  return useDb().transaction(async (tx) => {
    const [p] = await tx.select().from(pedido).where(eq(pedido.id, id)).for('update')
    if (!p) {
      throw createError({ statusCode: 404, statusMessage: 'Pedido no encontrado.' })
    }
    if (p.estado !== 'pendiente') {
      throw createError({ statusCode: 409, statusMessage: `El pedido ya está ${p.estado}.` })
    }

    const { turnoId, ...datos } = body
    const resultado = await crearCompra(tx, {
      ...datos,
      tiendaId: p.tiendaId,
      tipo: 'pedido',
      pedidoId: p.id,
      nombre: p.nombre,
      proveedor: p.proveedor,
      userId: session.user.id
    }, turnoId)

    await tx.update(pedido).set({ estado: 'recibido' }).where(eq(pedido.id, id))

    return resultado
  })
})
