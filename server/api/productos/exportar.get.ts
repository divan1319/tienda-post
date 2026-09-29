import { z } from 'zod'
import { and, asc, eq, sql } from 'drizzle-orm'
import { categoria, producto, stockTienda, tienda } from '~~/server/db/schema'

const querySchema = z.object({
  tiendaId: z.coerce.number().int().positive()
})

// Productos con el stock de una tienda (sirve de hoja para el conteo físico).
export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const { tiendaId } = await getValidatedQuery(event, validar(querySchema))
  await requireTiendaActiva(session.user, tiendaId)

  const [t] = await useDb().select({ nombre: tienda.nombre }).from(tienda).where(eq(tienda.id, tiendaId)).limit(1)

  const filas = await useDb()
    .select({
      nombre: producto.nombre,
      codigoBarras: producto.codigoBarras,
      categoria: categoria.nombre,
      unidadMedida: producto.unidadMedida,
      precio: producto.precioVentaCentavos,
      activo: producto.activo,
      stock: sql<number>`coalesce(${stockTienda.cantidad}, 0)`.mapWith(Number),
      stockMinimo: stockTienda.stockMinimo
    })
    .from(producto)
    .leftJoin(categoria, eq(categoria.id, producto.categoriaId))
    .leftJoin(stockTienda, and(eq(stockTienda.productoId, producto.id), eq(stockTienda.tiendaId, tiendaId)))
    .orderBy(asc(producto.nombre))

  return enviarCsv(event, nombreArchivoCsv('stock', t?.nombre, hoyLocal()), generarCsv(filas, [
    { titulo: 'Producto', valor: f => f.nombre },
    { titulo: 'Código de barras', valor: f => f.codigoBarras },
    { titulo: 'Categoría', valor: f => f.categoria ?? 'Sin categoría' },
    { titulo: 'Unidad', valor: f => f.unidadMedida },
    { titulo: 'Precio', valor: f => centavosCsv(f.precio) },
    { titulo: 'Stock', valor: f => f.stock },
    { titulo: 'Stock mínimo', valor: f => f.stockMinimo },
    { titulo: 'Estado', valor: f => f.stock < 0 ? 'por corregir' : f.stockMinimo !== null && f.stock <= f.stockMinimo ? 'stock bajo' : '' },
    { titulo: 'Activo', valor: f => f.activo ? 'sí' : 'no' }
  ]))
})
