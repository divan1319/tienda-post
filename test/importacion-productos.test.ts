import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { codigoDesdeNombre } from '../shared/utils/codigo'
import {
  parsearCodigoBarras,
  parsearPrecio,
  parsearUnidad,
  validarFilasImportacion,
  type ContextoImportacion,
  type FilaCrudaImportacion
} from '../shared/utils/importacion-productos'
import { ErrorArchivoExcel, generarPlantillaProductos, leerFilasProductos } from '../server/utils/excel-productos'

describe('codigoDesdeNombre', () => {
  it('pasa a snake_case sin acentos', () => {
    expect(codigoDesdeNombre('nombre categoria nuevo')).toBe('nombre_categoria_nuevo')
    expect(codigoDesdeNombre('Lácteos y huevos')).toBe('lacteos_y_huevos')
    expect(codigoDesdeNombre('  Niño / Ñandú -- Café  ')).toBe('nino_nandu_cafe')
    expect(codigoDesdeNombre('Snacks & golosinas 2x1')).toBe('snacks_golosinas_2x1')
  })

  it('vacío si no hay letras ni números', () => {
    expect(codigoDesdeNombre('¡¡!!')).toBe('')
    expect(codigoDesdeNombre('')).toBe('')
  })

  it('limita la longitud sin dejar «_» al final', () => {
    const codigo = codigoDesdeNombre(`${'a'.repeat(99)} b`)
    expect(codigo).toBe('a'.repeat(99))
  })
})

describe('parsearUnidad', () => {
  it('acepta valores, etiquetas y abreviaturas', () => {
    expect(parsearUnidad('Unidad')).toBe('unidad')
    expect(parsearUnidad('LIBRAS')).toBe('libra')
    expect(parsearUnidad('lb')).toBe('libra')
    expect(parsearUnidad(' Litro ')).toBe('litro')
    expect(parsearUnidad('L')).toBe('litro')
  })

  it('null si no la reconoce o está vacía', () => {
    expect(parsearUnidad('kilo')).toBeNull()
    expect(parsearUnidad(null)).toBeNull()
  })
})

describe('parsearPrecio', () => {
  it('convierte dólares a centavos', () => {
    expect(parsearPrecio(0.55)).toEqual({ centavos: 55 })
    expect(parsearPrecio('1.25')).toEqual({ centavos: 125 })
    expect(parsearPrecio('$ 3')).toEqual({ centavos: 300 })
    expect(parsearPrecio(0)).toEqual({ centavos: 0 })
    // Resultado de fórmula con error de coma flotante
    expect(parsearPrecio(0.1 + 0.2)).toEqual({ centavos: 30 })
  })

  it('rechaza vacíos, negativos, más de dos decimales y comas', () => {
    expect(parsearPrecio(null)).toEqual({ error: 'El precio es obligatorio.' })
    expect(parsearPrecio(-1)).toHaveProperty('error')
    expect(parsearPrecio(1.255)).toEqual({ error: 'El precio admite como máximo dos decimales.' })
    expect(parsearPrecio('1,25')).toHaveProperty('error')
    expect(parsearPrecio('abc')).toHaveProperty('error')
    expect(parsearPrecio(2_000_000)).toEqual({ error: 'El precio es demasiado alto.' })
  })
})

describe('parsearCodigoBarras', () => {
  it('pasa números enteros a texto', () => {
    expect(parsearCodigoBarras(7401234567890)).toEqual({ codigo: '7401234567890' })
    expect(parsearCodigoBarras(' 0012 ')).toEqual({ codigo: '0012' })
    expect(parsearCodigoBarras('')).toEqual({ codigo: null })
  })

  it('rechaza números con decimales', () => {
    expect(parsearCodigoBarras(12.5)).toHaveProperty('error')
  })
})

function fila(n: number, datos: Partial<FilaCrudaImportacion>): FilaCrudaImportacion {
  return { fila: n, nombre: null, codigoBarras: null, categoria: null, unidadMedida: null, precio: null, ...datos }
}

const contexto = (): ContextoImportacion => ({
  categoriasPorCodigo: new Map([
    ['bebidas', { id: 3, nombre: 'Bebidas', activa: true }],
    ['descontinuados', { id: 9, nombre: 'Descontinuados', activa: false }]
  ]),
  codigosBarrasExistentes: new Set(['111'])
})

describe('validarFilasImportacion', () => {
  it('acepta filas completas y busca la categoría por código', () => {
    const r = validarFilasImportacion([
      fila(2, { nombre: 'Agua 600 ml', codigoBarras: '222', categoria: 'BEBIDAS', unidadMedida: 'Unidad', precio: 0.6 })
    ], contexto())

    expect(r.validas).toBe(1)
    expect(r.conErrores).toBe(0)
    expect(r.filas[0]).toEqual({
      fila: 2,
      nombre: 'Agua 600 ml',
      codigoBarras: '222',
      categoria: { id: 3, nombre: 'Bebidas', codigo: 'bebidas' },
      unidadMedida: 'unidad',
      precioVentaCentavos: 60,
      errores: []
    })
  })

  it('marca categorías nuevas y las agrupa por código', () => {
    const r = validarFilasImportacion([
      fila(2, { nombre: 'Queso', categoria: 'Lácteos', unidadMedida: 'libra', precio: 3.5 }),
      fila(3, { nombre: 'Leche', categoria: 'lacteos', unidadMedida: 'unidad', precio: 1.25 })
    ], contexto())

    expect(r.validas).toBe(2)
    expect(r.categoriasNuevas).toEqual(['Lácteos'])
    expect(r.filas[1]!.categoria).toEqual({ id: null, nombre: 'Lácteos', codigo: 'lacteos' })
  })

  it('reporta los errores de cada fila', () => {
    const r = validarFilasImportacion([
      fila(2, { codigoBarras: '111', unidadMedida: 'kilo', precio: '1,5' }),
      fila(3, { nombre: 'A', codigoBarras: '333', unidadMedida: 'unidad', precio: 1 }),
      fila(4, { nombre: 'B', codigoBarras: '333', categoria: 'Descontinuados', unidadMedida: 'unidad', precio: 1 })
    ], contexto())

    expect(r.validas).toBe(1)
    expect(r.conErrores).toBe(2)
    expect(r.filas[0]!.errores).toEqual([
      'El nombre es obligatorio.',
      'Ya existe un producto con este código de barras.',
      'Unidad de medida no válida: usa Unidad, Libra, Litro.',
      'El precio debe ser un número con punto decimal (por ejemplo 1.25).'
    ])
    expect(r.filas[2]!.errores).toEqual([
      'El código de barras se repite en la fila 3.',
      'La categoría «Descontinuados» está inactiva: actívala en Categorías o usa otra.'
    ])
  })

  it('no crea categorías nuevas que solo usan filas con errores', () => {
    const r = validarFilasImportacion([
      fila(2, { nombre: 'X', categoria: 'Nueva', unidadMedida: 'unidad' })
    ], contexto())
    expect(r.categoriasNuevas).toEqual([])
  })
})

async function libroDePlantilla() {
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(await generarPlantillaProductos(['Bebidas', 'Granos básicos']) as unknown as ArrayBuffer)
  return libro
}

async function aBytes(libro: ExcelJS.Workbook) {
  return new Uint8Array(await libro.xlsx.writeBuffer() as ArrayBuffer)
}

describe('plantilla y lectura de Excel', () => {
  it('la plantilla trae encabezados, listas e instrucciones', async () => {
    const libro = await libroDePlantilla()
    const hoja = libro.getWorksheet('Productos')!

    // Las validaciones van por rango: la hoja no trae filas vacías
    expect(hoja.rowCount).toBe(1)
    expect(hoja.getRow(1).values).toEqual([undefined, 'Nombre', 'Código de barras', 'Categoría', 'Unidad de medida', 'Precio (USD)'])
    expect(hoja.getCell('D2').dataValidation).toMatchObject({ type: 'list', formulae: ['"Unidad,Libra,Litro"'] })
    expect(hoja.getCell('D2001').dataValidation).toMatchObject({ type: 'list' })
    expect(hoja.getCell('C2').dataValidation).toMatchObject({ type: 'list', formulae: ['Listas!$A$1:$A$2'] })
    expect(libro.getWorksheet('Listas')!.state).toBe('hidden')
    expect(libro.getWorksheet('Instrucciones')).toBeDefined()
  })

  it('lee las filas llenas de la plantilla', async () => {
    const libro = await libroDePlantilla()
    const hoja = libro.getWorksheet('Productos')!
    hoja.addRow(['Arroz blanco', null, 'Granos básicos', 'Libra', 0.55])
    hoja.addRow([])
    hoja.addRow([{ richText: [{ text: 'Agua ' }, { text: '600 ml' }] }, 7401234567890, 'Bebidas', 'Unidad', { formula: 'B1', result: 0.6 }])

    const filas = await leerFilasProductos(await aBytes(libro))
    expect(filas).toEqual([
      { fila: 2, nombre: 'Arroz blanco', codigoBarras: null, categoria: 'Granos básicos', unidadMedida: 'Libra', precio: 0.55 },
      { fila: 4, nombre: 'Agua 600 ml', codigoBarras: 7401234567890, categoria: 'Bebidas', unidadMedida: 'Unidad', precio: 0.6 }
    ])
  })

  it('reconoce las columnas por encabezado en cualquier orden', async () => {
    const libro = new ExcelJS.Workbook()
    const hoja = libro.addWorksheet('Hoja1')
    hoja.addRow(['PRECIO', 'Unidad', 'Producto'])
    hoja.addRow([2, 'u', 'Jabón'])

    const filas = await leerFilasProductos(await aBytes(libro))
    expect(filas).toEqual([{ fila: 2, nombre: 'Jabón', codigoBarras: null, categoria: null, unidadMedida: 'u', precio: 2 }])
  })

  it('rechaza archivos sin las columnas obligatorias, vacíos o dañados', async () => {
    const libro = new ExcelJS.Workbook()
    libro.addWorksheet('Productos').addRow(['Nombre', 'Precio'])
    await expect(leerFilasProductos(await aBytes(libro))).rejects.toThrow('Falta la columna «Unidad de medida»')

    const vacio = await libroDePlantilla()
    await expect(leerFilasProductos(await aBytes(vacio))).rejects.toThrow('no tiene productos')

    await expect(leerFilasProductos(new TextEncoder().encode('no es un excel'))).rejects.toBeInstanceOf(ErrorArchivoExcel)
  })
})
