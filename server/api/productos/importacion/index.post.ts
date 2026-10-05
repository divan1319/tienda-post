// Importa los productos válidos del Excel; las filas con errores se omiten y se informan.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const datos = await readExcel(event)

  try {
    return await importarProductos(datos)
  } catch (err) {
    handleDbError(err)
  }
})
