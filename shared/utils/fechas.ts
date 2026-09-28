/** Fecha de hoy en El Salvador como `YYYY-MM-DD`. */
export function hoyLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(new Date())
}

/** true si `fecha` (`YYYY-MM-DD`) es una fecha real del calendario. */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const d = new Date(`${fecha}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha
}
