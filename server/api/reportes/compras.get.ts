import { and, asc, count, eq, gte, lte, sql } from 'drizzle-orm'
import { compra, salidaCaja, tienda } from '~~/server/db/schema'

// Total comprado (con pedido y directas), cuánto se pagó con efectivo de caja,
// serie por periodo y listado de facturas. Se agrupa por fecha_compra.
export default defineEventHandler(async (event) => {
  const q = await leerReporteQuery(event)
  const db = useDb()

  const where = and(
    q.tiendaId ? eq(compra.tiendaId, q.tiendaId) : undefined,
    gte(compra.fechaCompra, q.desde),
    lte(compra.fechaCompra, q.hasta)
  )
  const conPedido = sql`${compra.tipo} = 'pedido'`
  const directa = sql`${compra.tipo} = 'directa'`

  const [[totales], serie, facturas] = await Promise.all([
    db
      .select({
        compras: count(),
        totalCentavos: sumaCentavos(compra.totalCentavos),
        conPedidoCentavos: sumaCentavos(compra.totalCentavos, conPedido),
        directasCentavos: sumaCentavos(compra.totalCentavos, directa),
        pagadoConCajaCentavos: sumaCentavos(compra.totalCentavos, sql`${salidaCaja.id} is not null`)
      })
      .from(compra)
      .leftJoin(salidaCaja, eq(salidaCaja.compraId, compra.id))
      .where(where),
    db
      .select({
        periodo: periodoDeFecha(compra.fechaCompra, q.periodo),
        conPedidoCentavos: sumaCentavos(compra.totalCentavos, conPedido),
        directasCentavos: sumaCentavos(compra.totalCentavos, directa)
      })
      .from(compra)
      .where(where)
      .groupBy(sql`1`),
    db
      .select({
        id: compra.id,
        fechaCompra: compra.fechaCompra,
        tiendaNombre: tienda.nombre,
        tipo: compra.tipo,
        nombre: compra.nombre,
        proveedor: compra.proveedor,
        numeroFactura: compra.numeroFactura,
        comprobanteKey: compra.comprobanteKey,
        totalCentavos: compra.totalCentavos,
        turnoPagoId: salidaCaja.turnoId
      })
      .from(compra)
      .innerJoin(tienda, eq(tienda.id, compra.tiendaId))
      .leftJoin(salidaCaja, eq(salidaCaja.compraId, compra.id))
      .where(where)
      .orderBy(asc(compra.fechaCompra), asc(compra.id))
      .limit(1000)
  ])

  return {
    periodo: q.periodo,
    totales: totales!,
    serie: rellenarSerie(q.periodos, serie, ['conPedidoCentavos', 'directasCentavos'] as const),
    facturas
  }
})
