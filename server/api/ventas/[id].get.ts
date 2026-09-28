export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { id } = await getValidatedRouterParams(event, validar(idParamSchema))

  const v = await obtenerVenta(useDb(), id)
  // La vendedora solo ve sus propias ventas
  if (!v || (!isAdmin(session.user) && v.userId !== session.user.id)) {
    throw createError({ statusCode: 404, statusMessage: 'Venta no encontrada.' })
  }
  return v
})
