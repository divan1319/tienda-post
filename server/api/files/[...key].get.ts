// Redirige a una URL firmada corta del storage de Neon. Exige sesión.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const key = getRouterParam(event, 'key')
  if (!key || key.split('/').some(parte => !parte || parte === '.' || parte === '..')) {
    throw createError({ statusCode: 400, statusMessage: 'Archivo no válido.' })
  }

  const url = await useStorageDriver().url(key)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return sendRedirect(event, url, 302)
})
