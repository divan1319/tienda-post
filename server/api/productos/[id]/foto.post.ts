import { eq, sql } from 'drizzle-orm'
import { producto } from '~~/server/db/schema'

const MAX_FOTO_BYTES = 5 * 1024 * 1024

// Sube o reemplaza la foto del producto. En la base se guarda solo la key.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, validar(idParamSchema))
  const db = useDb()

  const [actual] = await db.select({ fotoKey: producto.fotoKey }).from(producto).where(eq(producto.id, id)).limit(1)
  if (!actual) {
    throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado.' })
  }

  const archivo = await readArchivo(event, { tipos: TIPOS_IMAGEN, maxBytes: MAX_FOTO_BYTES })
  const storage = useStorageDriver()
  const { ref } = await storage.save(archivo.data, { prefix: `productos/${id}`, contentType: archivo.contentType })

  await db.update(producto).set({ fotoKey: ref, updatedAt: sql`now()` }).where(eq(producto.id, id))

  if (actual.fotoKey) {
    // La foto anterior ya no se referencia; si falla el borrado solo queda huérfana
    await storage.delete(actual.fotoKey).catch(err => console.warn('[storage] No se pudo borrar', actual.fotoKey, err))
  }

  return { fotoKey: ref }
})
