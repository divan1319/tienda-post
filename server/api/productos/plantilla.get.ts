import { asc, eq } from 'drizzle-orm'
import { categoria } from '~~/server/db/schema'

// Plantilla .xlsx para la importación masiva, con las categorías activas en la lista desplegable.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const categorias = await useDb()
    .select({ nombre: categoria.nombre })
    .from(categoria)
    .where(eq(categoria.activa, true))
    .orderBy(asc(categoria.nombre))

  const archivo = await generarPlantillaProductos(categorias.map(c => c.nombre))

  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="plantilla_productos.xlsx"')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return archivo
})
