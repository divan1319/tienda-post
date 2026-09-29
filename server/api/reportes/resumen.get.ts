import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import { compra, tienda, venta } from '~~/server/db/schema'

// Ventas vs. compras por periodo y por tienda. Como las compras no guardan productos,
// la diferencia es flujo de caja, no ganancia.
export default defineEventHandler(async (event) => {
  const q = await leerReporteQuery(event)
  const db = useDb()

  const ventasWhere = and(
    q.tiendaId ? eq(venta.tiendaId, q.tiendaId) : undefined,
    eq(venta.estado, 'completada'),
    desdeFechaLocal(venta.createdAt, q.desde),
    hastaFechaLocal(venta.createdAt, q.hasta)
  )
  const comprasWhere = and(
    q.tiendaId ? eq(compra.tiendaId, q.tiendaId) : undefined,
    gte(compra.fechaCompra, q.desde),
    lte(compra.fechaCompra, q.hasta)
  )

  const [serieVentas, serieCompras, ventasTienda, comprasTienda, tiendas] = await Promise.all([
    db
      .select({ periodo: periodoDeTimestamp(venta.createdAt, q.periodo), ventasCentavos: sumaCentavos(venta.totalCentavos) })
      .from(venta)
      .where(ventasWhere)
      .groupBy(sql`1`),
    db
      .select({ periodo: periodoDeFecha(compra.fechaCompra, q.periodo), comprasCentavos: sumaCentavos(compra.totalCentavos) })
      .from(compra)
      .where(comprasWhere)
      .groupBy(sql`1`),
    db.select({ tiendaId: venta.tiendaId, total: sumaCentavos(venta.totalCentavos) }).from(venta).where(ventasWhere).groupBy(venta.tiendaId),
    db.select({ tiendaId: compra.tiendaId, total: sumaCentavos(compra.totalCentavos) }).from(compra).where(comprasWhere).groupBy(compra.tiendaId),
    db
      .select({ id: tienda.id, nombre: tienda.nombre })
      .from(tienda)
      .where(q.tiendaId ? eq(tienda.id, q.tiendaId) : undefined)
      .orderBy(asc(tienda.nombre))
  ])

  const ventasPorPeriodo = rellenarSerie(q.periodos, serieVentas, ['ventasCentavos'] as const)
  const comprasPorPeriodo = rellenarSerie(q.periodos, serieCompras, ['comprasCentavos'] as const)
  const serie = ventasPorPeriodo.map((v, i) => ({
    periodo: v.periodo,
    ventasCentavos: v.ventasCentavos,
    comprasCentavos: comprasPorPeriodo[i]!.comprasCentavos,
    flujoCentavos: v.ventasCentavos - comprasPorPeriodo[i]!.comprasCentavos
  }))

  const porTienda = tiendas
    .map((t) => {
      const ventasCentavos = ventasTienda.find(v => v.tiendaId === t.id)?.total ?? 0
      const comprasCentavos = comprasTienda.find(c => c.tiendaId === t.id)?.total ?? 0
      return { tiendaId: t.id, nombre: t.nombre, ventasCentavos, comprasCentavos, flujoCentavos: ventasCentavos - comprasCentavos }
    })
    .filter(t => t.ventasCentavos || t.comprasCentavos || q.tiendaId)

  const ventasCentavos = serie.reduce((s, p) => s + p.ventasCentavos, 0)
  const comprasCentavos = serie.reduce((s, p) => s + p.comprasCentavos, 0)

  return {
    periodo: q.periodo,
    totales: { ventasCentavos, comprasCentavos, flujoCentavos: ventasCentavos - comprasCentavos },
    serie,
    porTienda
  }
})
