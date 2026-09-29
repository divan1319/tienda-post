import { hoyLocal } from '../../../shared/utils/fechas'

// El Salvador usa UTC-6 todo el año (sin horario de verano).
const DESFASE_HORAS = 6

/** Fecha local `YYYY-MM-DD` sumando `dias` (negativo = hacia atrás). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Instante (Date) de una fecha y hora locales de El Salvador. */
export function instante(fecha: string, minutosDelDia: number): Date {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a!, m! - 1, d!, DESFASE_HORAS, minutosDelDia))
}

/** Día de la semana de una fecha local (0 = domingo … 6 = sábado). */
export function diaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay()
}

/** Hoy y los minutos transcurridos del día en hora de El Salvador. */
export function ahoraLocal() {
  const ahora = new Date()
  const hoy = hoyLocal()
  const minutos = Math.floor((ahora.getTime() - instante(hoy, 0).getTime()) / 60000)
  return { hoy, minutos }
}

export const hora = (h: number, m = 0) => h * 60 + m
