import type { H3Event } from 'h3'
import { S3StorageDriver, EXTENSIONES, type StorageDriver } from '../storage'

let _storage: StorageDriver | null = null

export function useStorageDriver(): StorageDriver {
  if (!_storage) {
    _storage = new S3StorageDriver(getServerConfig().s3)
  }
  return _storage
}

export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']
export const TIPOS_COMPROBANTE = [...TIPOS_IMAGEN, 'application/pdf']

/**
 * Lee un archivo de un formulario multipart y valida tipo y tamaño
 * antes de enviarlo al storage.
 */
export async function readArchivo(
  event: H3Event,
  opts: { campo?: string, tipos: string[], maxBytes: number }
) {
  const campo = opts.campo ?? 'archivo'
  const partes = await readMultipartFormData(event)
  const archivo = partes?.find(p => p.name === campo && p.filename)

  if (!archivo) {
    throw createError({ statusCode: 400, statusMessage: 'No se recibió ningún archivo.' })
  }

  const tipo = archivo.type ?? ''
  if (!opts.tipos.includes(tipo) || !EXTENSIONES[tipo]) {
    throw createError({ statusCode: 415, statusMessage: 'Tipo de archivo no permitido.' })
  }

  if (archivo.data.byteLength > opts.maxBytes) {
    const mb = Math.round(opts.maxBytes / (1024 * 1024))
    throw createError({ statusCode: 413, statusMessage: `El archivo supera el tamaño máximo de ${mb} MB.` })
  }

  return { data: archivo.data, contentType: tipo }
}
