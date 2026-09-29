import { and, count, desc, eq, sql } from 'drizzle-orm'
import { compra, salidaCaja, tienda, user } from '~~/server/db/schema'

const querySchema = paginacionSchema.merge(comprasFiltrosSchema)

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, validar(querySchema))
  const { sinTipo: base, where } = condicionesCompras(query)
  const db = useDb()

  const suma = (condicion: ReturnType<typeof sql>) =>
    sql<number>`coalesce(sum(${compra.totalCentavos}) filter (where ${condicion}), 0)`.mapWith(Number)

  const [items, [total], [resumen]] = await Promise.all([
    db
      .select({
        id: compra.id,
        tiendaId: compra.tiendaId,
        tiendaNombre: tienda.nombre,
        tipo: compra.tipo,
        pedidoId: compra.pedidoId,
        nombre: compra.nombre,
        proveedor: compra.proveedor,
        totalCentavos: compra.totalCentavos,
        numeroFactura: compra.numeroFactura,
        comprobanteKey: compra.comprobanteKey,
        fechaCompra: compra.fechaCompra,
        usuario: user.name,
        createdAt: compra.createdAt,
        turnoPagoId: salidaCaja.turnoId
      })
      .from(compra)
      .innerJoin(tienda, eq(tienda.id, compra.tiendaId))
      .innerJoin(user, eq(user.id, compra.userId))
      .leftJoin(salidaCaja, eq(salidaCaja.compraId, compra.id))
      .where(where)
      .orderBy(desc(compra.fechaCompra), desc(compra.id))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(compra).where(where),
    // Totales del periodo (sin el filtro de tipo, para ver el desglose completo)
    db
      .select({
        compras: count(),
        totalCentavos: suma(sql`true`),
        conPedidoCentavos: suma(sql`${compra.tipo} = 'pedido'`),
        directasCentavos: suma(sql`${compra.tipo} = 'directa'`),
        pagadoConCajaCentavos: suma(sql`${salidaCaja.id} is not null`)
      })
      .from(compra)
      .leftJoin(salidaCaja, eq(salidaCaja.compraId, compra.id))
      .where(and(...base))
  ])

  return { total: total?.total ?? 0, resumen: resumen!, items }
})
