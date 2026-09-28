// Compra directa (sin pedido previo); con turnoId se paga con efectivo de ese turno.
const bodySchema = datosCompraSchema.extend({
  tiendaId: pedidoSchema.shape.tiendaId,
  nombre: pedidoSchema.shape.nombre,
  proveedor: pedidoSchema.shape.proveedor
})

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const body = await readValidatedBody(event, validar(bodySchema))
  await requireTiendaActiva(session.user, body.tiendaId)

  const { turnoId, ...datos } = body
  return useDb().transaction(tx => crearCompra(tx, {
    ...datos,
    tipo: 'directa',
    userId: session.user.id
  }, turnoId))
})
