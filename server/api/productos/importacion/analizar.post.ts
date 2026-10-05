// Vista previa de la importación: valida cada fila del Excel sin guardar nada.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const datos = await readExcel(event)
  return analizarImportacion(datos)
})
