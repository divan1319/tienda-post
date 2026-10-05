import { codigoDesdeNombre } from './codigo'
import { UNIDADES_MEDIDA, UNIDAD_LABEL, type UnidadMedida } from './cantidad'

// Importación masiva de productos desde Excel: mismas columnas que el formulario de
// alta, sin foto ni «activo» (se crean activos). El servidor lee la hoja, valida cada
// fila con estas funciones e importa solo las filas sin errores.

export const MAX_FILAS_IMPORTACION = 2000

export type CampoImportacion = 'nombre' | 'codigoBarras' | 'categoria' | 'unidadMedida' | 'precio'

export interface ColumnaImportacion {
  campo: CampoImportacion
  titulo: string
  /** Encabezados aceptados, comparados con codigoDesdeNombre */
  claves: string[]
  obligatoria: boolean
  ayuda: string
  ejemplo: string
  ancho: number
}

export const COLUMNAS_IMPORTACION: ColumnaImportacion[] = [
  {
    campo: 'nombre',
    titulo: 'Nombre',
    claves: ['nombre', 'producto', 'nombre_del_producto'],
    obligatoria: true,
    ayuda: 'Nombre del producto, máximo 150 caracteres.',
    ejemplo: 'Arroz blanco',
    ancho: 40
  },
  {
    campo: 'codigoBarras',
    titulo: 'Código de barras',
    claves: ['codigo_de_barras', 'codigo_barras', 'codigo'],
    obligatoria: false,
    ayuda: 'Opcional. No puede repetirse ni existir ya en el sistema.',
    ejemplo: '7401234567890',
    ancho: 22
  },
  {
    campo: 'categoria',
    titulo: 'Categoría',
    claves: ['categoria'],
    obligatoria: false,
    ayuda: 'Opcional. Elige una de la lista o escribe una nueva: si no existe, se crea al importar.',
    ejemplo: 'Granos básicos',
    ancho: 28
  },
  {
    campo: 'unidadMedida',
    titulo: 'Unidad de medida',
    claves: ['unidad_de_medida', 'unidad_medida', 'unidad'],
    obligatoria: true,
    ayuda: `${UNIDADES_MEDIDA.map(u => UNIDAD_LABEL[u]).join(', ')}. El precio es por esta unidad.`,
    ejemplo: 'Libra',
    ancho: 18
  },
  {
    campo: 'precio',
    titulo: 'Precio (USD)',
    claves: ['precio_usd', 'precio', 'precio_de_venta'],
    obligatoria: true,
    ayuda: 'Precio de venta en dólares, con punto decimal y hasta dos decimales (por ejemplo 0.55).',
    ejemplo: '0.55',
    ancho: 14
  }
]

/** Valor de una celda ya simplificado (texto o número) */
export type CeldaImportacion = string | number | null

export type FilaCrudaImportacion = { fila: number } & Record<CampoImportacion, CeldaImportacion>

export interface CategoriaExistente {
  id: number
  nombre: string
  activa: boolean
}

export interface ContextoImportacion {
  /** Categorías de la base indexadas por código */
  categoriasPorCodigo: Map<string, CategoriaExistente>
  /** Códigos de barras que ya tiene algún producto */
  codigosBarrasExistentes: Set<string>
}

export interface FilaImportacion {
  /** Número de fila en la hoja (la 1 es el encabezado) */
  fila: number
  nombre: string
  codigoBarras: string | null
  /** id null: la categoría no existe y se creará al importar */
  categoria: { id: number | null, nombre: string, codigo: string } | null
  unidadMedida: UnidadMedida | null
  precioVentaCentavos: number | null
  errores: string[]
}

export interface ResultadoAnalisis {
  filas: FilaImportacion[]
  validas: number
  conErrores: number
  /** Nombres de las categorías que se crearán */
  categoriasNuevas: string[]
}

const MAX_NOMBRE = 150
const MAX_CODIGO_BARRAS = 64
const MAX_NOMBRE_CATEGORIA = 100
const MAX_PRECIO_CENTAVOS = 100_000_000

function texto(valor: CeldaImportacion): string {
  if (valor === null) return ''
  return String(valor).trim()
}

const ALIAS_UNIDAD: Record<string, UnidadMedida> = {
  unidad: 'unidad',
  unidades: 'unidad',
  u: 'unidad',
  und: 'unidad',
  unid: 'unidad',
  libra: 'libra',
  libras: 'libra',
  lb: 'libra',
  lbs: 'libra',
  litro: 'litro',
  litros: 'litro',
  l: 'litro',
  lt: 'litro',
  lts: 'litro'
}

/** «Libra», «lb», «LIBRAS» → libra. null si no se reconoce. */
export function parsearUnidad(valor: CeldaImportacion): UnidadMedida | null {
  return ALIAS_UNIDAD[codigoDesdeNombre(texto(valor))] ?? null
}

/** Precio en dólares (número o texto «1.25» / «$1.25») → centavos, o un mensaje de error. */
export function parsearPrecio(valor: CeldaImportacion): { centavos: number } | { error: string } {
  let dolares: number
  if (typeof valor === 'number') {
    dolares = valor
  } else {
    const limpio = texto(valor).replace(/^\$\s*/, '')
    if (!limpio) return { error: 'El precio es obligatorio.' }
    if (!/^-?\d+(\.\d+)?$/.test(limpio)) {
      return { error: 'El precio debe ser un número con punto decimal (por ejemplo 1.25).' }
    }
    dolares = Number(limpio)
  }

  if (!Number.isFinite(dolares)) return { error: 'El precio no es válido.' }
  if (dolares < 0) return { error: 'El precio no puede ser negativo.' }
  // Tolerancia para valores de coma flotante que vienen de fórmulas (0.1 + 0.2)
  if (Math.abs(dolares * 100 - Math.round(dolares * 100)) > 1e-6) {
    return { error: 'El precio admite como máximo dos decimales.' }
  }
  const centavos = Math.round(dolares * 100)
  if (centavos > MAX_PRECIO_CENTAVOS) return { error: 'El precio es demasiado alto.' }
  return { centavos }
}

/** Código de barras como texto; los números largos de Excel se pasan a dígitos sin exponente. */
export function parsearCodigoBarras(valor: CeldaImportacion): { codigo: string | null } | { error: string } {
  if (typeof valor === 'number') {
    if (!Number.isSafeInteger(valor) || valor < 0) {
      return { error: 'Escribe el código de barras como texto (la celda tiene un número con decimales o demasiado grande).' }
    }
    return { codigo: String(valor) }
  }
  const codigo = texto(valor)
  if (!codigo) return { codigo: null }
  if (codigo.length > MAX_CODIGO_BARRAS) return { error: `El código de barras admite como máximo ${MAX_CODIGO_BARRAS} caracteres.` }
  return { codigo }
}

/**
 * Valida las filas leídas de la hoja contra el catálogo actual. Las categorías que no
 * existen quedan con id null (se crean al importar); todas las filas que nombran la
 * misma categoría nueva comparten el nombre de la primera.
 */
export function validarFilasImportacion(filas: FilaCrudaImportacion[], contexto: ContextoImportacion): ResultadoAnalisis {
  const codigosEnArchivo = new Map<string, number>()
  const nuevas = new Map<string, string>()

  const resultado = filas.map((cruda): FilaImportacion => {
    const errores: string[] = []

    const nombre = texto(cruda.nombre)
    if (!nombre) errores.push('El nombre es obligatorio.')
    else if (nombre.length > MAX_NOMBRE) errores.push(`El nombre admite como máximo ${MAX_NOMBRE} caracteres.`)

    let codigoBarras: string | null = null
    const codigo = parsearCodigoBarras(cruda.codigoBarras)
    if ('error' in codigo) {
      errores.push(codigo.error)
    } else if (codigo.codigo) {
      codigoBarras = codigo.codigo
      const filaAnterior = codigosEnArchivo.get(codigo.codigo)
      if (filaAnterior !== undefined) {
        errores.push(`El código de barras se repite en la fila ${filaAnterior}.`)
      } else {
        codigosEnArchivo.set(codigo.codigo, cruda.fila)
        if (contexto.codigosBarrasExistentes.has(codigo.codigo)) {
          errores.push('Ya existe un producto con este código de barras.')
        }
      }
    }

    let categoria: FilaImportacion['categoria'] = null
    const nombreCategoria = texto(cruda.categoria)
    if (nombreCategoria) {
      const codigoCategoria = codigoDesdeNombre(nombreCategoria)
      const existente = contexto.categoriasPorCodigo.get(codigoCategoria)
      if (!codigoCategoria) {
        errores.push('La categoría debe tener al menos una letra o un número.')
      } else if (existente) {
        categoria = { id: existente.id, nombre: existente.nombre, codigo: codigoCategoria }
        if (!existente.activa) {
          errores.push(`La categoría «${existente.nombre}» está inactiva: actívala en Categorías o usa otra.`)
        }
      } else if (nombreCategoria.length > MAX_NOMBRE_CATEGORIA) {
        errores.push(`El nombre de la categoría admite como máximo ${MAX_NOMBRE_CATEGORIA} caracteres.`)
      } else {
        if (!nuevas.has(codigoCategoria)) nuevas.set(codigoCategoria, nombreCategoria)
        categoria = { id: null, nombre: nuevas.get(codigoCategoria)!, codigo: codigoCategoria }
      }
    }

    const unidadMedida = parsearUnidad(cruda.unidadMedida)
    if (!unidadMedida) {
      errores.push(texto(cruda.unidadMedida)
        ? `Unidad de medida no válida: usa ${UNIDADES_MEDIDA.map(u => UNIDAD_LABEL[u]).join(', ')}.`
        : 'La unidad de medida es obligatoria.')
    }

    let precioVentaCentavos: number | null = null
    const precio = parsearPrecio(cruda.precio)
    if ('error' in precio) errores.push(precio.error)
    else precioVentaCentavos = precio.centavos

    return { fila: cruda.fila, nombre, codigoBarras, categoria, unidadMedida, precioVentaCentavos, errores }
  })

  const validas = resultado.filter(f => !f.errores.length)
  // Solo se crean las categorías nuevas que usa alguna fila válida
  const categoriasNuevas = [...new Set(validas.filter(f => f.categoria && f.categoria.id === null).map(f => f.categoria!.nombre))]

  return {
    filas: resultado,
    validas: validas.length,
    conErrores: resultado.length - validas.length,
    categoriasNuevas
  }
}

export interface FilaOmitida {
  fila: number
  nombre: string
  errores: string[]
}

export interface ResultadoImportacion {
  creados: number
  categoriasCreadas: string[]
  /** Filas que no se importaron, con sus motivos */
  omitidas: FilaOmitida[]
}
