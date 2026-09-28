import { eq } from 'drizzle-orm'
import { compra } from '~~/server/db/schema'

const MAX_COMPROBANTE_BYTES = 10 * 1024 * 1024

// Sube o reemplaza el comprobante (foto o PDF). En la base se guarda solo la key.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, validar(idParamSchema))
  const db = useDb()

  const [actual] = await db
    .select({ tiendaId: compra.tiendaId, comprobanteKey: compra.comprobanteKey })
    .from(compra)
    .where(eq(compra.id, id))
    .limit(1)
  if (!actual) {
    throw createError({ statusCode: 404, statusMessage: 'Compra no encontrada.' })
  }

  const archivo = await readArchivo(event, { tipos: TIPOS_COMPROBANTE, maxBytes: MAX_COMPROBANTE_BYTES })
  const storage = useStorageDriver()
  const { ref } = await storage.save(archivo.data, {
    prefix: `comprobantes/${actual.tiendaId}`,
    contentType: archivo.contentType
  })

  await db.update(compra).set({ comprobanteKey: ref }).where(eq(compra.id, id))

  if (actual.comprobanteKey) {
    await storage.delete(actual.comprobanteKey).catch(err => console.warn('[storage] No se pudo borrar', actual.comprobanteKey, err))
  }

  return { comprobanteKey: ref }
})
