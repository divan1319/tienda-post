import type { UnidadMedida } from '../utils/cantidad'
import type { MetodoPago } from '../utils/ventas'

// Formas serializadas (fechas como texto) de lo que devuelve la API de ventas y caja.

export interface VentaTicket {
  id: number
  tiendaId: number
  turnoId: number
  correlativo: number
  userId: string
  totalCentavos: number
  metodoPago: MetodoPago
  montoRecibidoCentavos: number
  cambioCentavos: number
  estado: 'completada' | 'anulada'
  conStockInsuficiente: boolean
  anuladaAt: string | null
  motivoAnulacion: string | null
  createdAt: string
  tiendaNombre: string
  tiendaDireccion: string | null
  vendedor: string
  anuladaPorNombre: string | null
  detalle: {
    productoId: number
    nombreProducto: string
    unidadMedida: UnidadMedida
    precioUnitarioCentavos: number
    cantidad: number
    subtotalCentavos: number
  }[]
}

export interface ResumenTurno {
  porMetodo: { metodoPago: MetodoPago, ventas: number, totalCentavos: number }[]
  ventas: number
  totalVendidoCentavos: number
  ventasAnuladas: number
  ventasEfectivoCentavos: number
  salidas: { id: number, montoCentavos: number, motivo: string, usuario: string, createdAt: string }[]
  salidasCentavos: number
  efectivoEsperadoCentavos: number
}

export interface TurnoConResumen {
  id: number
  tiendaId: number
  userId: string
  abiertoAt: string
  montoInicialCentavos: number
  cerradoAt: string | null
  efectivoEsperadoCentavos: number | null
  efectivoContadoCentavos: number | null
  diferenciaCentavos: number | null
  nota: string | null
  tiendaNombre?: string
  usuario?: string
  resumen: ResumenTurno
}
