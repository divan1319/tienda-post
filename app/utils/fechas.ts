const ZONA = 'America/El_Salvador'

const fechaHora = new Intl.DateTimeFormat('es-SV', {
  timeZone: ZONA,
  dateStyle: 'short',
  timeStyle: 'short'
})

/** Fecha y hora en la zona horaria de El Salvador (igual en SSR y en el cliente). */
export function formatFechaHora(valor: string | Date): string {
  return fechaHora.format(new Date(valor))
}

/** Fecha de hoy en El Salvador como `YYYY-MM-DD`. */
export function hoyLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}
