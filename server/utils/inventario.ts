import { eq, and, sql } from 'drizzle-orm'
import { movimientoInventario, stockTienda } from '../db/schema'
import type { Db } from '../db'

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type TipoMovimiento = typeof movimientoInventario.$inferInsert['tipo']

interface Movimiento {
  tiendaId: number
  productoId: number
  tipo: TipoMovimiento
  /** Con signo: positiva suma al stock, negativa resta */
  cantidad: number
  userId: string
  referenciaTipo?: string | null
  referenciaId?: number | null
  nota?: string | null
}

/**
 * Cambia el stock de un producto en una tienda y escribe su movimiento.
 * Debe llamarse dentro de una transacción. Usa un upsert atómico, sin bloqueo:
 * INSERT … ON CONFLICT (tienda_id, producto_id) DO UPDATE SET cantidad = cantidad + EXCLUDED.cantidad
 * Devuelve el saldo resultante (puede ser negativo).
 */
export async function aplicarMovimiento(tx: Tx, mov: Movimiento): Promise<number> {
  const [fila] = await tx
    .insert(stockTienda)
    .values({ tiendaId: mov.tiendaId, productoId: mov.productoId, cantidad: mov.cantidad })
    .onConflictDoUpdate({
      target: [stockTienda.tiendaId, stockTienda.productoId],
      set: { cantidad: sql`${sql.identifier('stock_tienda')}.${sql.identifier('cantidad')} + excluded.${sql.identifier('cantidad')}` }
    })
    .returning({ cantidad: stockTienda.cantidad })

  await tx.insert(movimientoInventario).values({
    tiendaId: mov.tiendaId,
    productoId: mov.productoId,
    tipo: mov.tipo,
    cantidad: mov.cantidad,
    userId: mov.userId,
    referenciaTipo: mov.referenciaTipo ?? null,
    referenciaId: mov.referenciaId ?? null,
    nota: mov.nota ?? null
  })

  return fila!.cantidad
}

/**
 * Bloquea la fila de stock (creándola en 0 si no existe) y devuelve la cantidad actual.
 * Se usa cuando la operación depende del saldo actual, como el conteo físico.
 */
export async function bloquearStock(tx: Tx, tiendaId: number, productoId: number): Promise<number> {
  await tx
    .insert(stockTienda)
    .values({ tiendaId, productoId, cantidad: 0 })
    .onConflictDoNothing({ target: [stockTienda.tiendaId, stockTienda.productoId] })

  const [fila] = await tx
    .select({ cantidad: stockTienda.cantidad })
    .from(stockTienda)
    .where(and(eq(stockTienda.tiendaId, tiendaId), eq(stockTienda.productoId, productoId)))
    .for('update')

  return fila!.cantidad
}
