import { asc, eq } from 'drizzle-orm'
import { tienda, user, venta, ventaDetalle } from '../db/schema'
import type { Consultor } from './inventario'

/** Venta con su detalle, tienda y vendedor (para ticket y detalle). */
export async function obtenerVenta(q: Consultor, id: number) {
  const [fila] = await q
    .select({ venta, tiendaNombre: tienda.nombre, tiendaDireccion: tienda.direccion, vendedor: user.name })
    .from(venta)
    .innerJoin(tienda, eq(tienda.id, venta.tiendaId))
    .innerJoin(user, eq(user.id, venta.userId))
    .where(eq(venta.id, id))
    .limit(1)

  if (!fila) return null

  const detalle = await q
    .select()
    .from(ventaDetalle)
    .where(eq(ventaDetalle.ventaId, id))
    .orderBy(asc(ventaDetalle.nombreProducto))

  let anuladaPorNombre: string | null = null
  if (fila.venta.anuladaPor) {
    const [admin] = await q.select({ name: user.name }).from(user).where(eq(user.id, fila.venta.anuladaPor)).limit(1)
    anuladaPorNombre = admin?.name ?? null
  }

  return {
    ...fila.venta,
    tiendaNombre: fila.tiendaNombre,
    tiendaDireccion: fila.tiendaDireccion,
    vendedor: fila.vendedor,
    anuladaPorNombre,
    detalle
  }
}

export type VentaCompleta = NonNullable<Awaited<ReturnType<typeof obtenerVenta>>>
