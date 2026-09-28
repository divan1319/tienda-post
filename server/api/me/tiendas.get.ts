// Tiendas asignadas (todas las activas para el admin) y la tienda activa.
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { tiendas, tiendaActivaId } = await sincronizarTiendaActiva(session.user.id)

  return {
    tiendas,
    tiendaActivaId,
    // Con varias tiendas y ninguna activa se muestra el selector obligatorio
    requiereSeleccion: !tiendaActivaId && tiendas.length > 1
  }
})
