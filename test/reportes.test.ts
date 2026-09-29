import { describe, expect, it } from 'vitest'
import {
  formatPeriodo,
  generarPeriodos,
  inicioPeriodo,
  rellenarSerie,
  ticketPromedio
} from '../shared/utils/reportes'

describe('inicioPeriodo', () => {
  it('trunca como date_trunc', () => {
    expect(inicioPeriodo('2026-09-28', 'dia')).toBe('2026-09-28')
    expect(inicioPeriodo('2026-09-28', 'mes')).toBe('2026-09-01')
    expect(inicioPeriodo('2026-09-28', 'anio')).toBe('2026-01-01')
  })
})

describe('generarPeriodos', () => {
  it('días incluyendo ambos extremos y cambio de mes', () => {
    expect(generarPeriodos('dia', '2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  })

  it('años bisiestos', () => {
    expect(generarPeriodos('dia', '2024-02-28', '2024-03-01')).toEqual(['2024-02-28', '2024-02-29', '2024-03-01'])
  })

  it('meses: el primero empieza en el mes de `desde` aunque sea a mitad de mes', () => {
    expect(generarPeriodos('mes', '2026-11-15', '2027-02-03')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01'])
  })

  it('años', () => {
    expect(generarPeriodos('anio', '2024-06-01', '2026-01-01')).toEqual(['2024-01-01', '2025-01-01', '2026-01-01'])
  })

  it('un solo día y rango vacío', () => {
    expect(generarPeriodos('dia', '2026-09-29', '2026-09-29')).toEqual(['2026-09-29'])
    expect(generarPeriodos('dia', '2026-09-29', '2026-09-28')).toEqual([])
  })

  it('se detiene al pasar el máximo', () => {
    expect(generarPeriodos('dia', '2026-01-01', '2026-12-31', 10)).toHaveLength(11)
  })
})

describe('rellenarSerie', () => {
  it('rellena con cero los periodos sin datos y respeta el orden', () => {
    const periodos = ['2026-09-27', '2026-09-28', '2026-09-29']
    const filas = [{ periodo: '2026-09-28', total: 370, ventas: 2 }]
    expect(rellenarSerie(periodos, filas, ['total', 'ventas'] as const)).toEqual([
      { periodo: '2026-09-27', total: 0, ventas: 0 },
      { periodo: '2026-09-28', total: 370, ventas: 2 },
      { periodo: '2026-09-29', total: 0, ventas: 0 }
    ])
  })
})

describe('ticketPromedio', () => {
  it('redondea y evita dividir entre cero', () => {
    expect(ticketPromedio(1000, 3)).toBe(333)
    expect(ticketPromedio(0, 0)).toBe(0)
  })
})

describe('formatPeriodo', () => {
  it('etiquetas cortas', () => {
    expect(formatPeriodo('2026-09-28', 'dia')).toBe('28/09')
    expect(formatPeriodo('2026-09-01', 'mes')).toBe('sep 2026')
    expect(formatPeriodo('2026-01-01', 'anio')).toBe('2026')
  })
})
