import { aMilesimas } from './cantidad'
import { formatUSD } from './dinero'

// Cálculos de venta y caja. Todo en centavos enteros; cantidades con hasta 3 decimales.
// El servidor usa estas funciones para calcular; la interfaz, para mostrar la vista previa.

export const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'] as const
export type MetodoPago = typeof METODOS_PAGO[number]

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia'
}

// Sin literales `500n`/`1000n`: el target del cliente (es2019) no admite literales BigInt
// y esbuild avisa al compilar. La función BigInt() sí está disponible en el navegador.
const QUINIENTOS = BigInt(500)
const MIL = BigInt(1000)

/**
 * Subtotal de línea: round(precio_unitario_centavos × cantidad), redondeo al centavo
 * más cercano (medio centavo hacia arriba). Se calcula con BigInt sobre milésimas para
 * que sea exacto aunque el producto supere el rango seguro de los enteros de JS.
 */
export function subtotalLinea(precioUnitarioCentavos: number, cantidad: number): number {
  const milesimas = BigInt(aMilesimas(cantidad))
  const producto = BigInt(precioUnitarioCentavos) * milesimas
  return Number((producto + QUINIENTOS) / MIL)
}

/** Total de la venta: suma de los subtotales ya redondeados. */
export function totalVenta(subtotales: number[]): number {
  return subtotales.reduce((suma, s) => suma + s, 0)
}

/**
 * Monto recibido y cambio según el método de pago. En efectivo el monto recibido debe
 * cubrir el total; con tarjeta o transferencia se registra exactamente el total.
 */
export function calcularCobro(
  totalCentavos: number,
  metodo: MetodoPago,
  montoRecibidoCentavos?: number | null
): { montoRecibidoCentavos: number, cambioCentavos: number } | { error: string } {
  if (metodo !== 'efectivo') {
    return { montoRecibidoCentavos: totalCentavos, cambioCentavos: 0 }
  }
  if (montoRecibidoCentavos === undefined || montoRecibidoCentavos === null || !Number.isInteger(montoRecibidoCentavos)) {
    return { error: 'Ingresa el monto recibido.' }
  }
  if (montoRecibidoCentavos < totalCentavos) {
    return { error: 'El monto recibido no cubre el total.' }
  }
  return { montoRecibidoCentavos, cambioCentavos: montoRecibidoCentavos - totalCentavos }
}

/** Efectivo esperado del turno: inicial + ventas en efectivo completadas − salidas. */
export function efectivoEsperado(p: {
  montoInicialCentavos: number
  ventasEfectivoCentavos: number
  salidasCentavos: number
}): number {
  return p.montoInicialCentavos + p.ventasEfectivoCentavos - p.salidasCentavos
}

/**
 * Valida una salida de efectivo contra el esperado actual del turno.
 * Devuelve un mensaje de error o null.
 */
export function validarMontoSalida(montoCentavos: number, esperadoCentavos: number): string | null {
  if (!Number.isInteger(montoCentavos) || montoCentavos <= 0) {
    return 'El monto de la salida debe ser mayor que cero.'
  }
  if (montoCentavos > esperadoCentavos) {
    return `La salida supera el efectivo disponible en caja (${formatUSD(Math.max(esperadoCentavos, 0))}).`
  }
  return null
}

/** Correlativo con ceros a la izquierda para ticket y listados. */
export function formatCorrelativo(correlativo: number): string {
  return String(correlativo).padStart(6, '0')
}
