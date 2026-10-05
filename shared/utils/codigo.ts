// Código de catálogo derivado del nombre, en snake_case y sin acentos:
// «Lácteos y huevos» → lacteos_y_huevos. Lo usan el formulario (vista previa),
// la API al crear una categoría y la importación para buscar categorías por nombre.

export const CODIGO_MAXIMO = 100

/** Devuelve el código del nombre, o un texto vacío si no tiene letras ni números. */
export function codigoDesdeNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, CODIGO_MAXIMO)
    .replace(/_+$/, '')
}
