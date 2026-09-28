import { inArray } from 'drizzle-orm'
import { producto } from '../db/schema'
import type { UnidadMedida } from '../../shared/utils/cantidad'

interface Linea {
  productoId: number
  cantidad: number
}

/**
 * Valida líneas de producto + cantidad contra la base: productos existentes y activos,
 * sin repetidos y con cantidades válidas para su unidad de medida.
 * Devuelve los productos indexados por id.
 */
export async function validarLineas(lineas: Linea[]) {
  const ids = lineas.map(l => l.productoId)
  if (new Set(ids).size !== ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'Hay productos repetidos; junta sus cantidades en una sola línea.' })
  }

  const productos = await useDb()
    .select({
      id: producto.id,
      nombre: producto.nombre,
      unidadMedida: producto.unidadMedida,
      precioVentaCentavos: producto.precioVentaCentavos,
      activo: producto.activo
    })
    .from(producto)
    .where(inArray(producto.id, ids))

  const porId = new Map(productos.map(p => [p.id, p]))

  for (const linea of lineas) {
    const p = porId.get(linea.productoId)
    if (!p) {
      throw createError({ statusCode: 400, statusMessage: `El producto #${linea.productoId} no existe.` })
    }
    if (!p.activo) {
      throw createError({ statusCode: 400, statusMessage: `El producto "${p.nombre}" está desactivado.` })
    }
    const error = validarCantidad(linea.cantidad, p.unidadMedida as UnidadMedida)
    if (error) {
      throw createError({ statusCode: 400, statusMessage: `${p.nombre}: ${error}` })
    }
  }

  return porId
}

/** Confirma que la tienda existe y está activa (para rutas de admin que reciben tiendaId). */
export async function requireTiendaActiva(user: { id: string, role?: string | null }, tiendaId: number) {
  if (!(await puedeUsarTienda(user, tiendaId))) {
    throw createError({ statusCode: 400, statusMessage: 'La tienda no existe o está inactiva.' })
  }
}
