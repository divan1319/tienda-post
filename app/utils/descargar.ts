/** Descarga un CSV generado en el navegador (datos que ya están en pantalla). */
export function descargarCsv(nombre: string, contenido: string) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** URL de una exportación del servidor con los filtros actuales (omite los vacíos). */
export function urlExportacion(ruta: string, query: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, String(valor))
  }
  const texto = params.toString()
  return texto ? `${ruta}?${texto}` : ruta
}
