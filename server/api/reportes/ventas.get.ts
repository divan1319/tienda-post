import { and, count, desc, eq, sql } from 'drizzle-orm'
import { producto, tienda, venta, ventaDetalle } from '~~/server/db/schema'

// Total vendido, número de ventas, ticket promedio, desglose por método de pago,
// productos más vendidos y serie por periodo. Solo ventas completadas.
export default defineEventHandler(async (event) => {
  const q = await leerReporteQuery(event)
  const db = useDb()

  const rango = and(
    q.tiendaId ? eq(venta.tiendaId, q.tiendaId) : undefined,
    desdeFechaLocal(venta.createdAt, q.desde),
    hastaFechaLocal(venta.createdAt, q.hasta)
  )
  const completadas = and(rango, eq(venta.estado, 'completada'))
  const periodo = periodoDeTimestamp(venta.createdAt, q.periodo)

  const [[totales], [anuladas], porMetodo, serie, topProductos, porTienda] = await Promise.all([
    db.select({ ventas: count(), totalCentavos: sumaCentavos(venta.totalCentavos) }).from(venta).where(completadas),
    db.select({ ventas: count() }).from(venta).where(and(rango, eq(venta.estado, 'anulada'))),
    db
      .select({ metodoPago: venta.metodoPago, ventas: count(), totalCentavos: sumaCentavos(venta.totalCentavos) })
      .from(venta)
      .where(completadas)
      .groupBy(venta.metodoPago),
    db
      .select({ periodo, ventas: count(), totalCentavos: sumaCentavos(venta.totalCentavos) })
      .from(venta)
      .where(completadas)
      .groupBy(sql`1`),
    db
      .select({
        productoId: ventaDetalle.productoId,
        nombre: producto.nombre,
        unidadMedida: ventaDetalle.unidadMedida,
        cantidad: sql<number>`sum(${ventaDetalle.cantidad})`.mapWith(Number),
        totalCentavos: sumaCentavos(ventaDetalle.subtotalCentavos)
      })
      .from(ventaDetalle)
      .innerJoin(venta, eq(venta.id, ventaDetalle.ventaId))
      .innerJoin(producto, eq(producto.id, ventaDetalle.productoId))
      .where(completadas)
      .groupBy(ventaDetalle.productoId, producto.nombre, ventaDetalle.unidadMedida)
      .orderBy(desc(sql`5`))
      .limit(10),
    db
      .select({ tiendaId: tienda.id, nombre: tienda.nombre, ventas: count(), totalCentavos: sumaCentavos(venta.totalCentavos) })
      .from(venta)
      .innerJoin(tienda, eq(tienda.id, venta.tiendaId))
      .where(completadas)
      .groupBy(tienda.id, tienda.nombre)
      .orderBy(desc(sql`4`))
  ])

  const totalCentavos = totales?.totalCentavos ?? 0
  const ventas = totales?.ventas ?? 0

  return {
    periodo: q.periodo,
    totales: {
      ventas,
      totalCentavos,
      ticketPromedioCentavos: ticketPromedio(totalCentavos, ventas),
      anuladas: anuladas?.ventas ?? 0
    },
    porMetodo: METODOS_PAGO.map(m => ({
      metodoPago: m,
      ventas: porMetodo.find(p => p.metodoPago === m)?.ventas ?? 0,
      totalCentavos: porMetodo.find(p => p.metodoPago === m)?.totalCentavos ?? 0
    })),
    serie: rellenarSerie(q.periodos, serie, ['ventas', 'totalCentavos'] as const),
    topProductos,
    porTienda
  }
})
