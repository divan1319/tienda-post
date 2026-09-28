import { z } from 'zod'
import { compra } from '../db/schema'
import type { Tx } from './inventario'

/** Datos de dinero comunes a compra directa y recepción de pedido. */
export const datosCompraSchema = z.object({
  totalCentavos: z.number().int().positive('El total debe ser mayor que cero').max(100_000_000),
  numeroFactura: z.string().trim().max(60).nullish().transform(v => v || null),
  // Hoy por defecto; el admin puede cambiarla, pero no a una fecha futura
  fechaCompra: fechaSchema
    .refine(f => f <= hoyLocal(), 'La fecha de compra no puede ser futura')
    .default(() => hoyLocal()),
  // Si viene, la compra se paga con efectivo de ese turno (salida de caja)
  turnoId: z.number().int().positive().nullish()
})

type DatosCompra = z.output<typeof datosCompraSchema>

interface NuevaCompra extends Omit<DatosCompra, 'turnoId'> {
  tiendaId: number
  tipo: 'pedido' | 'directa'
  pedidoId?: number | null
  nombre: string
  proveedor: string | null
  userId: string
}

/**
 * Crea la compra y, si se indica un turno, la salida de caja que la paga, en la misma
 * transacción. Si la salida no pasa sus validaciones, no se guarda nada.
 */
export async function crearCompra(tx: Tx, datos: NuevaCompra, turnoId?: number | null) {
  const [nueva] = await tx
    .insert(compra)
    .values({
      tiendaId: datos.tiendaId,
      tipo: datos.tipo,
      pedidoId: datos.pedidoId ?? null,
      nombre: datos.nombre,
      proveedor: datos.proveedor,
      totalCentavos: datos.totalCentavos,
      numeroFactura: datos.numeroFactura,
      fechaCompra: datos.fechaCompra,
      userId: datos.userId
    })
    .returning()

  let salida = null
  if (turnoId) {
    salida = await registrarSalida(tx, {
      turnoId,
      tiendaId: datos.tiendaId,
      userId: datos.userId,
      montoCentavos: nueva!.totalCentavos,
      motivo: `Compra: ${datos.nombre}`,
      compra: { id: nueva!.id, totalCentavos: nueva!.totalCentavos }
    })
  }

  return { compra: nueva!, salida }
}
