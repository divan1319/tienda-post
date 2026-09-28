import { z } from 'zod'
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { compra, salidaCaja, tienda, user } from '~~/server/db/schema'

const querySchema = paginacionSchema.extend({
  tiendaId: queryId,
  tipo: z.enum(['pedido', 'directa']).optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const db = useDb()

  // fecha_compra es una fecha local: se compara directo con desde/hasta
  const base = [
    query.tiendaId ? eq(compra.tiendaId, query.tiendaId) : undefined,
    query.desde ? gte(compra.fechaCompra, query.desde) : undefined,
    query.hasta ? lte(compra.fechaCompra, query.hasta) : undefined
  ]
  const where = and(...base, query.tipo ? eq(compra.tipo, query.tipo) : undefined)

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
