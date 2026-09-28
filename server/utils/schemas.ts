import { z } from 'zod'
import { UNIDADES_MEDIDA } from '../../shared/utils/cantidad'

export const tiendaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  direccion: z.string().trim().max(300).nullish().transform(v => v || null),
  activa: z.boolean().default(true)
})

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
})

// ---------- Catálogo ----------

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  activa: z.boolean().default(true)
})

export const productoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  codigoBarras: z.string().trim().max(64).nullish().transform(v => v || null),
  categoriaId: z.number().int().positive().nullish().transform(v => v ?? null),
  unidadMedida: z.enum(UNIDADES_MEDIDA),
  precioVentaCentavos: z.number().int('El precio va en centavos enteros').min(0).max(100_000_000),
  activo: z.boolean().default(true)
})

/** Número de consulta opcional (los query params llegan como texto) */
export const queryId = z.coerce.number().int().positive().optional()

export const paginacionSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0)
})

/** Cantidad con signo positivo; la validación por unidad de medida se hace con validarCantidad */
export const cantidadSchema = z.number().finite()

// ---------- Pedidos ----------

export const pedidoSchema = z.object({
  tiendaId: z.number().int().positive(),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  proveedor: z.string().trim().max(150).nullish().transform(v => v || null),
  fechaEsperada: fechaSchema,
  nota: z.string().trim().max(500).nullish().transform(v => v || null)
})
