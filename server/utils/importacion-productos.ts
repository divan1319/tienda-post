import type { H3Event } from 'h3'
import { inArray } from 'drizzle-orm'
import { categoria, producto } from '../db/schema'
import {
  parsearCodigoBarras,
  validarFilasImportacion,
  type FilaCrudaImportacion,
  type FilaOmitida,
  type ResultadoAnalisis,
  type ResultadoImportacion
} from '../../shared/utils/importacion-productos'
import { ErrorArchivoExcel, leerFilasProductos } from './excel-productos'
import type { Consultor } from './inventario'

const MAX_EXCEL_BYTES = 2 * 1024 * 1024
// Un .xlsx es un ZIP: empieza con «PK\x03\x04»
const FIRMA_ZIP = [0x50, 0x4B, 0x03, 0x04]

/** Lee el Excel (.xlsx) del campo «archivo» de un formulario multipart. */
export async function readExcel(event: H3Event) {
  const partes = await readMultipartFormData(event)
  const archivo = partes?.find(p => p.name === 'archivo' && p.filename)

  if (!archivo) {
    throw createError({ statusCode: 400, statusMessage: 'No se recibió ningún archivo.' })
  }
  if (archivo.data.byteLength > MAX_EXCEL_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'El archivo supera el tamaño máximo de 2 MB.' })
  }
  if (!archivo.filename!.toLowerCase().endsWith('.xlsx') || !FIRMA_ZIP.every((byte, i) => archivo.data[i] === byte)) {
    throw createError({ statusCode: 415, statusMessage: 'Sube el archivo en formato Excel (.xlsx). Puedes partir de la plantilla.' })
  }

  return archivo.data
}

/** Lee la hoja y valida cada fila contra las categorías y los códigos de barras de la base. */
export async function analizarImportacion(datos: Uint8Array, q: Consultor = useDb()): Promise<ResultadoAnalisis> {
  let crudas: FilaCrudaImportacion[]
  try {
    crudas = await leerFilasProductos(datos)
  } catch (err) {
    if (err instanceof ErrorArchivoExcel) {
      throw createError({ statusCode: 400, statusMessage: err.message })
    }
    throw err
  }

  const codigos = [...new Set(crudas.flatMap((f) => {
    const r = parsearCodigoBarras(f.codigoBarras)
    return 'codigo' in r && r.codigo ? [r.codigo] : []
  }))]

  const [categorias, existentes] = await Promise.all([
    q.select({ id: categoria.id, nombre: categoria.nombre, codigo: categoria.codigo, activa: categoria.activa }).from(categoria),
    codigos.length
      ? q.select({ codigoBarras: producto.codigoBarras }).from(producto).where(inArray(producto.codigoBarras, codigos))
      : Promise.resolve([])
  ])

  return validarFilasImportacion(crudas, {
    categoriasPorCodigo: new Map(categorias.map(c => [c.codigo, c])),
    codigosBarrasExistentes: new Set(existentes.map(p => p.codigoBarras!))
  })
}

const LOTE = 500

/**
 * Importa las filas válidas en una transacción: crea las categorías que falten y los
 * productos (activos, sin foto ni stock). Las filas con errores se devuelven como omitidas.
 */
export async function importarProductos(datos: Uint8Array): Promise<ResultadoImportacion> {
  return useDb().transaction(async (tx) => {
    const analisis = await analizarImportacion(datos, tx)
    const validas = analisis.filas.filter(f => !f.errores.length)
    const omitidas: FilaOmitida[] = analisis.filas
      .filter(f => f.errores.length)
      .map(f => ({ fila: f.fila, nombre: f.nombre, errores: f.errores }))

    if (!validas.length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay filas válidas para importar. Corrige los errores y vuelve a subir el archivo.' })
    }

    // Categorías nuevas: si otra importación la creó mientras tanto, se usa esa
    const nuevas = new Map(validas.filter(f => f.categoria && f.categoria.id === null).map(f => [f.categoria!.codigo, f.categoria!.nombre]))
    let categoriasCreadas: string[] = []
    const idsNuevas = new Map<string, number>()
    if (nuevas.size) {
      const creadas = await tx
        .insert(categoria)
        .values([...nuevas].map(([codigo, nombre]) => ({ codigo, nombre })))
        .onConflictDoNothing()
        .returning({ nombre: categoria.nombre })
      categoriasCreadas = creadas.map(c => c.nombre)

      const filas = await tx.select({ id: categoria.id, codigo: categoria.codigo }).from(categoria).where(inArray(categoria.codigo, [...nuevas.keys()]))
      for (const c of filas) idsNuevas.set(c.codigo, c.id)
    }

    const aInsertar: { fila: number, valores: typeof producto.$inferInsert }[] = []
    for (const f of validas) {
      let categoriaId = f.categoria?.id ?? null
      if (f.categoria && categoriaId === null) {
        categoriaId = idsNuevas.get(f.categoria.codigo) ?? null
        if (categoriaId === null) {
          // Otra categoría ya tiene ese nombre con un código distinto
          omitidas.push({ fila: f.fila, nombre: f.nombre, errores: [`No se pudo crear la categoría «${f.categoria.nombre}»: ya existe otra con ese nombre.`] })
          continue
        }
      }
      aInsertar.push({
        fila: f.fila,
        valores: {
          nombre: f.nombre,
          codigoBarras: f.codigoBarras,
          categoriaId,
          unidadMedida: f.unidadMedida!,
          precioVentaCentavos: f.precioVentaCentavos!
        }
      })
    }

    let creados = 0
    for (let i = 0; i < aInsertar.length; i += LOTE) {
      const lote = aInsertar.slice(i, i + LOTE)
      // Si otro registro tomó el código de barras después del análisis, esa fila se omite
      const insertados = await tx
        .insert(producto)
        .values(lote.map(l => l.valores))
        .onConflictDoNothing({ target: producto.codigoBarras })
        .returning({ codigoBarras: producto.codigoBarras })
      creados += insertados.length

      const conCodigo = new Set(insertados.map(p => p.codigoBarras))
      for (const l of lote) {
        if (l.valores.codigoBarras && !conCodigo.has(l.valores.codigoBarras)) {
          omitidas.push({ fila: l.fila, nombre: l.valores.nombre, errores: ['Ya existe un producto con este código de barras.'] })
        }
      }
    }

    omitidas.sort((a, b) => a.fila - b.fila)
    return { creados, categoriasCreadas, omitidas }
  })
}
