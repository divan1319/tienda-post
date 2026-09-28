// Turno abierto del usuario en la tienda activa, con totales parciales (o null).
export default defineEventHandler(async (event) => {
  const { session, tiendaId } = await requireTienda(event)
  const db = useDb()

  const turno = await turnoAbierto(db, tiendaId, session.user.id)
  if (!turno) return { tiendaId, turno: null }

  return { tiendaId, turno: { ...turno, resumen: await resumenTurno(db, turno) } }
})
