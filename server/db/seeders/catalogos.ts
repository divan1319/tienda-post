import type { Db } from '../index'
import { categoria } from '../schema'
import { codigoDesdeNombre } from '../../../shared/utils/codigo'

// Catálogos base. `pnpm db:seed:catalogos` los crea si no existen (idempotente);
// la demo usa los mismos.

export const CATEGORIAS = [
  'Abarrotes',
  'Granos básicos',
  'Bebidas',
  'Lácteos y huevos',
  'Panadería',
  'Limpieza',
  'Higiene personal',
  'Snacks y golosinas'
] as const

/** Crea las categorías que falten (por nombre o código) y devuelve las creadas. */
export async function sembrarCatalogos(db: Db) {
  const categorias = await db
    .insert(categoria)
    .values(CATEGORIAS.map(nombre => ({ nombre, codigo: codigoDesdeNombre(nombre) })))
    .onConflictDoNothing()
    .returning({ id: categoria.id, nombre: categoria.nombre, codigo: categoria.codigo })

  return { categorias }
}
