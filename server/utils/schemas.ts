import { z } from 'zod'

export const tiendaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  direccion: z.string().trim().max(300).nullish().transform(v => v || null),
  activa: z.boolean().default(true)
})

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
})
