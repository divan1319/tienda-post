import { z } from 'zod'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { movimientoInventario as m, producto, user } from '~~/server/db/schema'

const querySchema = z.object({
  tiendaId: z.coerce.number().int().positive(),
  productoId: queryId,
  tipo: z.enum(['entrada', 'venta', 'anulacion_venta', 'ajuste']).optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200)
})

// Kardex: movimientos por tienda (y producto) con el saldo acumulado después de cada uno.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const db = useDb()

  // El saldo se calcula sobre todo el historial y luego se filtra por fecha y tipo,
  // así el saldo de cada fila es el real aunque se muestre solo un rango.
  const conSaldo = db
    .select({
      id: m.id,
      productoId: m.productoId,
      tipo: m.tipo,
      cantidad: m.cantidad,
      referenciaTipo: m.referenciaTipo,
      referenciaId: m.referenciaId,
      userId: m.userId,
      nota: m.nota,
      createdAt: m.createdAt,
      saldo: sql<number>`sum(${m.cantidad}) over (partition by ${m.productoId} order by ${m.createdAt}, ${m.id})`
        .mapWith(Number)
        .as('saldo')
    })
    .from(m)
    .where(and(
      eq(m.tiendaId, query.tiendaId),
      query.productoId ? eq(m.productoId, query.productoId) : undefined
    ))
    .as('k')

  const filtros: (SQL | undefined)[] = [
    query.tipo ? eq(conSaldo.tipo, query.tipo) : undefined,
    query.desde ? desdeFechaLocal(conSaldo.createdAt, query.desde) : undefined,
    query.hasta ? hastaFechaLocal(conSaldo.createdAt, query.hasta) : undefined
  ]

  return db
    .select({
      id: conSaldo.id,
      productoId: conSaldo.productoId,
      productoNombre: producto.nombre,
      unidadMedida: producto.unidadMedida,
      tipo: conSaldo.tipo,
      cantidad: conSaldo.cantidad,
      saldo: conSaldo.saldo,
      referenciaTipo: conSaldo.referenciaTipo,
      referenciaId: conSaldo.referenciaId,
      nota: conSaldo.nota,
      usuario: user.name,
      createdAt: conSaldo.createdAt
    })
    .from(conSaldo)
    .innerJoin(producto, eq(producto.id, conSaldo.productoId))
    .innerJoin(user, eq(user.id, conSaldo.userId))
    .where(and(...filtros))
    .orderBy(desc(conSaldo.createdAt), desc(conSaldo.id))
    .limit(query.limit)
})
