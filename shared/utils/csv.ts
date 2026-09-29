// Exportación a CSV: separador coma, fin de línea CRLF y BOM UTF-8 para que Excel
// respete tildes y eñes. Montos y cantidades van como números con punto decimal.

export type CeldaCsv = string | number | null | undefined

export interface ColumnaCsv<T> {
  titulo: string
  valor: (fila: T) => CeldaCsv
}

const NUMERO = /^-?\d+(\.\d+)?$/

/**
 * Escapa una celda. Un texto que empieza con = + - @ (o tabulador / retorno) se
 * antepone con ' para que la hoja de cálculo no lo ejecute como fórmula.
 */
export function celdaCsv(valor: CeldaCsv): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : ''

  let texto = valor
  if (!NUMERO.test(texto) && /^[=+\-@\t\r]/.test(texto)) {
    texto = `'${texto}`
  }
  if (/[",\r\n]/.test(texto)) {
    texto = `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

export function generarCsv<T>(filas: T[], columnas: ColumnaCsv<T>[]): string {
  const lineas = [
    columnas.map(c => celdaCsv(c.titulo)).join(','),
    ...filas.map(f => columnas.map(c => celdaCsv(c.valor(f))).join(','))
  ]
  return `\uFEFF${lineas.join('\r\n')}\r\n`
}

/** Centavos → texto con dos decimales («12.50», «-0.75»). */
export function centavosCsv(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return ''
  return (centavos / 100).toFixed(2)
}

const partesFechaHora = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/El_Salvador',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

/** Fecha y hora local de El Salvador como `YYYY-MM-DD HH:mm`. */
export function fechaHoraCsv(valor: string | Date | null | undefined): string {
  if (!valor) return ''
  const p = Object.fromEntries(partesFechaHora.formatToParts(new Date(valor)).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

/** Nombre de archivo seguro: letras, números, guiones. */
export function nombreArchivoCsv(...partes: (string | number | undefined | null)[]): string {
  const base = partes
    .filter(p => p !== undefined && p !== null && p !== '')
    .map(p => String(p).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('_')
  return `${base || 'exportacion'}.csv`
}
