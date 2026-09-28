import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { producto } from '~~/server/db/schema'
import type { UnidadMedida } from '~~/shared/utils/cantidad'

const bodySchema = z.object({
  tiendaId: z.number().int().positive(),
  productoId: z.number().int().positive(),
  // conteo: la cantidad es lo contado y el stock queda igual a eso
  // salida / entrada: la cantidad se resta o se suma (merma, vencido, transferencia…)
  modo: z.enum(['conteo', 'salida', 'entrada']),
  cantidad: cantidadSchema,
  motivo: z.string().trim().min(3, 'El motivo es obligatorio').max(500)
})

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  await requireTiendaActiva(session.user, body.tiendaId)

  const [p] = await useDb()
    .select({ nombre: producto.nombre, unidadMedida: producto.unidadMedida })
    .from(producto)
    .where(eq(producto.id, body.productoId))
    .limit(1)
  if (!p) {
    throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado.' })
  }

  const error = validarCantidad(body.cantidad, p.unidadMedida as UnidadMedida, { permitirCero: body.modo === 'conteo' })
  if (error) {
    throw createError({ statusCode: 400, statusMessage: error })
  }

  return useDb().transaction(async (tx) => {
    let delta: number
    if (body.modo === 'conteo') {
      // Con la fila bloqueada, la diferencia no cambia por una venta simultánea
      const actual = await bloquearStock(tx, body.tiendaId, body.productoId)
      delta = restarCantidades(body.cantidad, actual)
    } else {
      delta = body.modo === 'salida' ? -body.cantidad : body.cantidad
    }

    if (delta === 0) {
      return { sinCambios: true, stock: body.cantidad }
    }

    const stock = await aplicarMovimiento(tx, {
      tiendaId: body.tiendaId,
      productoId: body.productoId,
      tipo: 'ajuste',
      cantidad: delta,
      userId: session.user.id,
      referenciaTipo: body.modo,
      nota: body.motivo
    })

    return { sinCambios: false, diferencia: delta, stock }
  })
})
