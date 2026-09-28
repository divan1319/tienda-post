// Cantidades de inventario y venta: numeric(12,3) en la base, hasta tres decimales.
// Las cuentas se hacen en milésimas enteras para no arrastrar errores de coma flotante.

export const UNIDADES_MEDIDA = ['unidad', 'libra', 'litro'] as const
export type UnidadMedida = typeof UNIDADES_MEDIDA[number]

export const UNIDAD_LABEL: Record<UnidadMedida, string> = {
  unidad: 'Unidad',
  libra: 'Libra',
  litro: 'Litro'
}

export const UNIDAD_ABREV: Record<UnidadMedida, string> = {
  unidad: 'u',
  libra: 'lb',
  litro: 'L'
}

// numeric(12,3): hasta 9 dígitos enteros
export const CANTIDAD_MAXIMA = 999_999_999.999

export function aMilesimas(cantidad: number): number {
  return Math.round(cantidad * 1000)
}

export function deMilesimas(milesimas: number): number {
  return milesimas / 1000
}

/** true si el número tiene como máximo tres decimales. */
export function tieneMaxTresDecimales(cantidad: number): boolean {
  return Number.isFinite(cantidad) && Math.abs(aMilesimas(cantidad) - cantidad * 1000) < 1e-6
}

/**
 * Valida una cantidad según la unidad de medida. Devuelve un mensaje de error o null.
 * - `unidad`: solo enteros; `libra` y `litro`: hasta tres decimales.
 * - `permitirCero` se usa en el conteo físico (se puede contar 0).
 */
export function validarCantidad(
  cantidad: number,
  unidad: UnidadMedida,
  opts: { permitirCero?: boolean } = {}
): string | null {
  if (!Number.isFinite(cantidad)) return 'La cantidad no es válida.'
  if (opts.permitirCero ? cantidad < 0 : cantidad <= 0) {
    return opts.permitirCero ? 'La cantidad no puede ser negativa.' : 'La cantidad debe ser mayor que cero.'
  }
  if (cantidad > CANTIDAD_MAXIMA) return 'La cantidad es demasiado grande.'
  if (unidad === 'unidad' && !Number.isInteger(cantidad)) {
    return 'Este producto se vende por unidad: la cantidad no puede tener decimales.'
  }
  if (!tieneMaxTresDecimales(cantidad)) return 'La cantidad admite como máximo tres decimales.'
  return null
}

/** Diferencia exacta a - b con tres decimales. */
export function restarCantidades(a: number, b: number): number {
  return deMilesimas(aMilesimas(a) - aMilesimas(b))
}

/** Formato para pantalla y ticket: 3 decimales para libra/litro, entero para unidad. */
export function formatCantidad(cantidad: number, unidad: UnidadMedida): string {
  const decimales = unidad === 'unidad' ? 0 : 3
  return cantidad.toLocaleString('en-US', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: 3
  })
}
