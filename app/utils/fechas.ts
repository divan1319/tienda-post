const ZONA = 'America/El_Salvador'

// Se arma a partir de partes numéricas: el texto de Intl con estilo (p. ej. «p. m.»)
// cambia entre las versiones de ICU de Node y del navegador y rompe la hidratación.
const partesFechaHora = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

/** `dd/mm/aaaa HH:mm` en la zona horaria de El Salvador (igual en SSR y en el cliente). */
export function formatFechaHora(valor: string | Date): string {
  const p = Object.fromEntries(
    partesFechaHora.formatToParts(new Date(valor)).map(parte => [parte.type, parte.value])
  )
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/** Fecha de hoy en El Salvador como `YYYY-MM-DD`. */
export function hoyLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}
