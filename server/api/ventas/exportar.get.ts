import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { tienda, user, venta, ventaDetalle } from '~~/server/db/schema'

const MAX_FILAS = 50_000

const querySchema = ventasFiltrosSchema.extend({
  // venta: una fila por venta · linea: una fila por producto vendido
  nivel: z.enum(['venta', 'linea']).default('venta')
})

// CSV de ventas con los mismos filtros (y permisos) que el listado.
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, validar(querySchema))
  const { where } = await condicionesVentas(event, query)
  const db = useDb()
  const nombre = nombreArchivoCsv('ventas', query.nivel === 'linea' ? 'detalle' : undefined, query.desde, query.hasta)

  if (query.nivel === 'linea') {
    const filas = await db
      .select({
        createdAt: venta.createdAt,
        tienda: tienda.nombre,
        correlativo: venta.correlativo,
        vendedor: user.name,
        estado: venta.estado,
        metodoPago: venta.metodoPago,
        producto: ventaDetalle.nombreProducto,
        unidadMedida: ventaDetalle.unidadMedida,
        cantidad: ventaDetalle.cantidad,
        precio: ventaDetalle.precioUnitarioCentavos,
        subtotal: ventaDetalle.subtotalCentavos
      })
      .from(ventaDetalle)
      .innerJoin(venta, eq(venta.id, ventaDetalle.ventaId))
      .innerJoin(tienda, eq(tienda.id, venta.tiendaId))
      .innerJoin(user, eq(user.id, venta.userId))
      .where(where)
      .orderBy(asc(venta.createdAt), asc(venta.id), asc(ventaDetalle.nombreProducto))
      .limit(MAX_FILAS)

    return enviarCsv(event, nombre, generarCsv(filas, [
      { titulo: 'Fecha', valor: f => fechaHoraCsv(f.createdAt) },
      { titulo: 'Tienda', valor: f => f.tienda },
      { titulo: 'Ticket', valor: f => formatCorrelativo(f.correlativo) },
      { titulo: 'Vendedor', valor: f => f.vendedor },
      { titulo: 'Estado', valor: f => f.estado },
      { titulo: 'Método de pago', valor: f => METODO_PAGO_LABEL[f.metodoPago] },
      { titulo: 'Producto', valor: f => f.producto },
      { titulo: 'Unidad', valor: f => f.unidadMedida },
      { titulo: 'Cantidad', valor: f => f.cantidad },
      { titulo: 'Precio unitario', valor: f => centavosCsv(f.precio) },
      { titulo: 'Subtotal', valor: f => centavosCsv(f.subtotal) }
    ]))
  }

  const filas = await db
    .select({
      createdAt: venta.createdAt,
      tienda: tienda.nombre,
      correlativo: venta.correlativo,
      vendedor: user.name,
      metodoPago: venta.metodoPago,
      total: venta.totalCentavos,
      recibido: venta.montoRecibidoCentavos,
      cambio: venta.cambioCentavos,
      estado: venta.estado,
      conStockInsuficiente: venta.conStockInsuficiente,
      motivoAnulacion: venta.motivoAnulacion
    })
    .from(venta)
    .innerJoin(tienda, eq(tienda.id, venta.tiendaId))
    .innerJoin(user, eq(user.id, venta.userId))
    .where(where)
    .orderBy(asc(venta.createdAt), asc(venta.id))
    .limit(MAX_FILAS)

  return enviarCsv(event, nombre, generarCsv(filas, [
    { titulo: 'Fecha', valor: f => fechaHoraCsv(f.createdAt) },
    { titulo: 'Tienda', valor: f => f.tienda },
    { titulo: 'Ticket', valor: f => formatCorrelativo(f.correlativo) },
    { titulo: 'Vendedor', valor: f => f.vendedor },
    { titulo: 'Método de pago', valor: f => METODO_PAGO_LABEL[f.metodoPago] },
    { titulo: 'Total', valor: f => centavosCsv(f.total) },
    { titulo: 'Recibido', valor: f => centavosCsv(f.recibido) },
    { titulo: 'Cambio', valor: f => centavosCsv(f.cambio) },
    { titulo: 'Estado', valor: f => f.estado },
    { titulo: 'Sin stock suficiente', valor: f => f.conStockInsuficiente ? 'sí' : 'no' },
    { titulo: 'Motivo de anulación', valor: f => f.motivoAnulacion }
  ]))
})
