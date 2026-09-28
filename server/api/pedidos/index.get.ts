import { z } from 'zod'
import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { compra, pedido, tienda } from '~~/server/db/schema'

const querySchema = paginacionSchema.extend({
  tiendaId: queryId,
  estado: z.enum(['pendiente', 'recibido', 'cancelado']).optional()
})

// Hoy según la hora de El Salvador (para clasificar los pendientes)
const hoySV = sql`(now() AT TIME ZONE 'America/El_Salvador')::date`

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const db = useDb()

  const where = and(
    query.tiendaId ? eq(pedido.tiendaId, query.tiendaId) : undefined,
    query.estado ? eq(pedido.estado, query.estado) : undefined
  )

  // Pendientes: los más urgentes primero; el resto, los más recientes primero
  const orden = query.estado === 'pendiente'
    ? [asc(pedido.fechaEsperada), asc(pedido.id)]
    : [desc(pedido.fechaEsperada), desc(pedido.id)]

  const [items, [total]] = await Promise.all([
    db
      .select({
        id: pedido.id,
        tiendaId: pedido.tiendaId,
        tiendaNombre: tienda.nombre,
        nombre: pedido.nombre,
        proveedor: pedido.proveedor,
        fechaEsperada: pedido.fechaEsperada,
        estado: pedido.estado,
        nota: pedido.nota,
        createdAt: pedido.createdAt,
        // 'atrasado' | 'hoy' | 'proximo' (solo para pendientes)
        situacion: sql<'atrasado' | 'hoy' | 'proximo' | null>`case
          when ${pedido.estado} <> 'pendiente' then null
          when ${pedido.fechaEsperada} < ${hoySV} then 'atrasado'
          when ${pedido.fechaEsperada} = ${hoySV} then 'hoy'
          else 'proximo' end`,
        compraId: compra.id,
        compraTotalCentavos: compra.totalCentavos
      })
      .from(pedido)
      .innerJoin(tienda, eq(tienda.id, pedido.tiendaId))
      .leftJoin(compra, eq(compra.pedidoId, pedido.id))
      .where(where)
      .orderBy(...orden)
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(pedido).where(where)
  ])

  return { total: total?.total ?? 0, items }
})
