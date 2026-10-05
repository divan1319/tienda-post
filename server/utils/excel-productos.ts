import ExcelJS from 'exceljs'
import type { CellValue, DataValidation } from 'exceljs'
import { codigoDesdeNombre } from '../../shared/utils/codigo'
import { UNIDADES_MEDIDA, UNIDAD_LABEL } from '../../shared/utils/cantidad'
import {
  COLUMNAS_IMPORTACION,
  MAX_FILAS_IMPORTACION,
  type CampoImportacion,
  type CeldaImportacion,
  type FilaCrudaImportacion
} from '../../shared/utils/importacion-productos'

// Plantilla y lectura de Excel (.xlsx) para la importación de productos.
// Sin auto-imports de Nitro: así también se puede probar con Vitest.

export const HOJA_PRODUCTOS = 'Productos'
const HOJA_LISTAS = 'Listas'
const AZUL = 'FF0F62FE'

/** Error de contenido del archivo; la ruta lo convierte en un 400 con este mensaje. */
export class ErrorArchivoExcel extends Error {}

/**
 * Plantilla de importación: hoja «Productos» con los encabezados y listas desplegables
 * (unidad de medida y categorías activas), y una hoja «Instrucciones».
 */
export async function generarPlantillaProductos(categorias: string[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Tienda POS'
  libro.created = new Date()

  const hoja = libro.addWorksheet(HOJA_PRODUCTOS, { views: [{ state: 'frozen', ySplit: 1 }] })
  hoja.columns = COLUMNAS_IMPORTACION.map(c => ({ header: c.titulo, key: c.campo, width: c.ancho }))

  const encabezado = hoja.getRow(1)
  // Fuente completa: sin nombre ni tamaño, algunos visores muestran celdas con tamaños distintos
  encabezado.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
  COLUMNAS_IMPORTACION.forEach((c, i) => {
    const celda = encabezado.getCell(i + 1)
    celda.note = `${c.obligatoria ? 'Obligatorio' : 'Opcional'}. ${c.ayuda}`
  })

  const columna = (campo: CampoImportacion) => COLUMNAS_IMPORTACION.findIndex(c => c.campo === campo) + 1

  // Texto: Excel no convierte los códigos de barras en notación científica
  hoja.getColumn(columna('codigoBarras')).numFmt = '@'
  hoja.getColumn(columna('precio')).numFmt = '0.00'

  // Hoja oculta con las categorías para la lista desplegable
  const listas = libro.addWorksheet(HOJA_LISTAS, { state: 'hidden' })
  categorias.forEach((nombre, i) => {
    listas.getCell(i + 1, 1).value = nombre
  })

  // Validaciones por rango (worksheet.dataValidations no está en los tipos de exceljs);
  // asignarlas celda por celda crearía miles de filas vacías en la plantilla
  const validaciones = (hoja as unknown as { dataValidations: { add: (rango: string, v: DataValidation) => void } }).dataValidations
  const rango = (campo: CampoImportacion) => {
    const letra = hoja.getColumn(columna(campo)).letter
    return `${letra}2:${letra}${MAX_FILAS_IMPORTACION + 1}`
  }

  const unidades = UNIDADES_MEDIDA.map(u => UNIDAD_LABEL[u])
  validaciones.add(rango('unidadMedida'), {
    type: 'list',
    allowBlank: true,
    formulae: [`"${unidades.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Unidad de medida',
    error: `Usa ${unidades.join(', ')}.`
  })
  validaciones.add(rango('precio'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    allowBlank: true,
    formulae: [0],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Precio',
    error: 'El precio debe ser un número mayor o igual a 0.'
  })
  if (categorias.length) {
    // Sin mensaje de error: se puede escribir una categoría nueva
    validaciones.add(rango('categoria'), {
      type: 'list',
      allowBlank: true,
      formulae: [`${HOJA_LISTAS}!$A$1:$A$${categorias.length}`],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: 'Categoría',
      prompt: 'Elige una de la lista o escribe una nueva (se crea al importar).'
    })
  }

  const instrucciones = libro.addWorksheet('Instrucciones')
  instrucciones.columns = [
    { header: 'Columna', key: 'columna', width: 20 },
    { header: '¿Obligatoria?', key: 'obligatoria', width: 14 },
    { header: 'Qué escribir', key: 'ayuda', width: 80 },
    { header: 'Ejemplo', key: 'ejemplo', width: 18 }
  ]
  instrucciones.getRow(1).font = { name: 'Calibri', size: 11, bold: true }
  for (const c of COLUMNAS_IMPORTACION) {
    instrucciones.addRow({ columna: c.titulo, obligatoria: c.obligatoria ? 'Sí' : 'No', ayuda: c.ayuda, ejemplo: c.ejemplo })
  }
  instrucciones.addRow({})
  for (const linea of [
    `Llena la hoja «${HOJA_PRODUCTOS}» desde la fila 2, un producto por fila (máximo ${MAX_FILAS_IMPORTACION}). No cambies los encabezados.`,
    'Los productos se crean activos y sin foto; la foto se agrega después desde Productos.',
    'Al subir el archivo verás una vista previa y los errores por fila. Solo se importan las filas sin errores.'
  ]) {
    instrucciones.addRow({ columna: linea })
  }

  libro.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }]

  return Buffer.from(await libro.xlsx.writeBuffer() as ArrayBuffer)
}

/** Texto o número de una celda; fórmulas por su resultado, texto enriquecido unido. */
export function valorCelda(valor: CellValue): CeldaImportacion {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor === 'string') return valor
  if (typeof valor === 'boolean') return String(valor)
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if ('richText' in valor) return valor.richText.map(t => t.text).join('')
  if ('hyperlink' in valor) return valor.text
  if ('formula' in valor || 'sharedFormula' in valor) {
    const resultado = valor.result
    if (resultado === undefined || (typeof resultado === 'object' && !(resultado instanceof Date))) return null
    return valorCelda(resultado)
  }
  return null
}

function vacia(valor: CeldaImportacion) {
  return valor === null || (typeof valor === 'string' && !valor.trim())
}

/**
 * Lee la hoja «Productos» (o la primera) y devuelve una fila cruda por producto.
 * Las columnas se reconocen por su encabezado, en cualquier orden.
 */
export async function leerFilasProductos(datos: Uint8Array): Promise<FilaCrudaImportacion[]> {
  const libro = new ExcelJS.Workbook()
  try {
    // exceljs tipa el parámetro como ArrayBuffer, pero en Node acepta un Buffer
    await libro.xlsx.load(Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength) as unknown as ArrayBuffer)
  } catch {
    throw new ErrorArchivoExcel('No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.')
  }

  const hoja = libro.getWorksheet(HOJA_PRODUCTOS) ?? libro.worksheets.find(h => h.state === 'visible')
  if (!hoja) throw new ErrorArchivoExcel('El archivo no tiene hojas.')

  const columnas = new Map<CampoImportacion, number>()
  hoja.getRow(1).eachCell((celda, numero) => {
    const clave = codigoDesdeNombre(String(valorCelda(celda.value) ?? ''))
    const columna = COLUMNAS_IMPORTACION.find(c => c.claves.includes(clave))
    if (columna && !columnas.has(columna.campo)) columnas.set(columna.campo, numero)
  })

  const faltantes = COLUMNAS_IMPORTACION.filter(c => c.obligatoria && !columnas.has(c.campo))
  if (faltantes.length) {
    throw new ErrorArchivoExcel(
      `Falta la columna ${faltantes.map(c => `«${c.titulo}»`).join(', ')} en la fila 1 de la hoja «${hoja.name}». Usa la plantilla.`
    )
  }

  const filas: FilaCrudaImportacion[] = []
  hoja.eachRow((row, numero) => {
    if (numero === 1) return
    const fila = { fila: numero } as FilaCrudaImportacion
    for (const c of COLUMNAS_IMPORTACION) {
      const indice = columnas.get(c.campo)
      fila[c.campo] = indice ? valorCelda(row.getCell(indice).value) : null
    }
    if (COLUMNAS_IMPORTACION.every(c => vacia(fila[c.campo]))) return
    filas.push(fila)
  })

  if (!filas.length) throw new ErrorArchivoExcel(`La hoja «${hoja.name}» no tiene productos: llénala desde la fila 2.`)
  if (filas.length > MAX_FILAS_IMPORTACION) {
    throw new ErrorArchivoExcel(`El archivo tiene ${filas.length} productos; el máximo por importación es ${MAX_FILAS_IMPORTACION}.`)
  }

  return filas
}
