import { describe, expect, it } from 'vitest'
import { celdaCsv, centavosCsv, fechaHoraCsv, generarCsv, nombreArchivoCsv } from '../shared/utils/csv'

describe('celdaCsv', () => {
  it('deja pasar texto y números simples', () => {
    expect(celdaCsv('Arroz')).toBe('Arroz')
    expect(celdaCsv(12.5)).toBe('12.5')
    expect(celdaCsv('12.50')).toBe('12.50')
    expect(celdaCsv('-0.75')).toBe('-0.75')
  })

  it('vacíos para null, undefined y no finitos', () => {
    expect(celdaCsv(null)).toBe('')
    expect(celdaCsv(undefined)).toBe('')
    expect(celdaCsv(Number.NaN)).toBe('')
  })

  it('entrecomilla comas, comillas y saltos de línea', () => {
    expect(celdaCsv('Arroz, blanco')).toBe('"Arroz, blanco"')
    expect(celdaCsv('Aceite "La Rosa"')).toBe('"Aceite ""La Rosa"""')
    expect(celdaCsv('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"')
  })

  it('neutraliza fórmulas (inyección en hojas de cálculo)', () => {
    expect(celdaCsv('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(celdaCsv('+50')).toBe('+50'.replace('+', '\'+'))
    expect(celdaCsv('-algo')).toBe('\'-algo')
    expect(celdaCsv('@SUM(A1)')).toBe('\'@SUM(A1)')
  })
})

describe('generarCsv', () => {
  it('encabezados, filas, CRLF y BOM', () => {
    const csv = generarCsv(
      [{ n: 'Jabón', t: 125 }, { n: 'Arroz, 1 lb', t: 80 }],
      [{ titulo: 'Producto', valor: f => f.n }, { titulo: 'Total', valor: f => centavosCsv(f.t) }]
    )
    expect(csv).toBe('\uFEFFProducto,Total\r\nJabón,1.25\r\n"Arroz, 1 lb",0.80\r\n')
  })
})

describe('formatos', () => {
  it('centavos con dos decimales', () => {
    expect(centavosCsv(1250)).toBe('12.50')
    expect(centavosCsv(-75)).toBe('-0.75')
    expect(centavosCsv(null)).toBe('')
  })

  it('fecha y hora en El Salvador (UTC-6)', () => {
    expect(fechaHoraCsv('2026-09-27T05:30:00Z')).toBe('2026-09-26 23:30')
    expect(fechaHoraCsv(null)).toBe('')
  })

  it('nombre de archivo sin tildes ni espacios', () => {
    expect(nombreArchivoCsv('Ventas', 'Tienda Año', '2026-09-01')).toBe('ventas_tienda-ano_2026-09-01.csv')
    expect(nombreArchivoCsv()).toBe('exportacion.csv')
    expect(nombreArchivoCsv('ventas-por-periodo_todas_2026-09-01')).toBe('ventas-por-periodo_todas_2026-09-01.csv')
  })
})
