import { asc, eq } from 'drizzle-orm'
import { compra, salidaCaja, tienda, user } from '~~/server/db/schema'

// CSV de compras con los mismos filtros que el listado.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, validar(comprasFiltrosSchema))
  const { where } = condicionesCompras(query)

  const filas = await useDb()
    .select({
      fechaCompra: compra.fechaCompra,
      tienda: tienda.nombre,
      tipo: compra.tipo,
      nombre: compra.nombre,
      proveedor: compra.proveedor,
      numeroFactura: compra.numeroFactura,
      total: compra.totalCentavos,
      turnoPagoId: salidaCaja.turnoId,
      comprobante: compra.comprobanteKey,
      usuario: user.name
    })
    .from(compra)
    .innerJoin(tienda, eq(tienda.id, compra.tiendaId))
    .innerJoin(user, eq(user.id, compra.userId))
    .leftJoin(salidaCaja, eq(salidaCaja.compraId, compra.id))
    .where(where)
    .orderBy(asc(compra.fechaCompra), asc(compra.id))
    .limit(50_000)

  return enviarCsv(event, nombreArchivoCsv('compras', query.desde, query.hasta), generarCsv(filas, [
    { titulo: 'Fecha', valor: f => f.fechaCompra },
    { titulo: 'Tienda', valor: f => f.tienda },
    { titulo: 'Tipo', valor: f => f.tipo === 'pedido' ? 'con pedido' : 'directa' },
    { titulo: 'Compra', valor: f => f.nombre },
    { titulo: 'Proveedor', valor: f => f.proveedor },
    { titulo: 'Factura', valor: f => f.numeroFactura },
    { titulo: 'Total', valor: f => centavosCsv(f.total) },
    { titulo: 'Pagada con caja', valor: f => f.turnoPagoId ? `turno ${f.turnoPagoId}` : 'no' },
    { titulo: 'Comprobante', valor: f => f.comprobante ? 'sí' : 'no' },
    { titulo: 'Registró', valor: f => f.usuario }
  ]))
})
