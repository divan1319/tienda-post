import { describe, expect, it } from 'vitest'
import {
  formatCantidad,
  restarCantidades,
  tieneMaxTresDecimales,
  validarCantidad
} from '../shared/utils/cantidad'
import { dolaresACentavos, formatUSD } from '../shared/utils/dinero'

describe('validarCantidad', () => {
  it('acepta enteros positivos por unidad', () => {
    expect(validarCantidad(3, 'unidad')).toBeNull()
  })

  it('rechaza decimales por unidad', () => {
    expect(validarCantidad(1.5, 'unidad')).toMatch(/decimales/)
  })

  it('acepta hasta tres decimales en libra y litro', () => {
    expect(validarCantidad(1.25, 'libra')).toBeNull()
    expect(validarCantidad(0.001, 'litro')).toBeNull()
    expect(validarCantidad(1.1, 'libra')).toBeNull()
  })

  it('rechaza más de tres decimales', () => {
    expect(validarCantidad(1.2345, 'libra')).toMatch(/tres decimales/)
  })

  it('rechaza cero y negativos, salvo cero en conteo', () => {
    expect(validarCantidad(0, 'unidad')).toMatch(/mayor que cero/)
    expect(validarCantidad(-1, 'libra')).toMatch(/mayor que cero/)
    expect(validarCantidad(0, 'unidad', { permitirCero: true })).toBeNull()
    expect(validarCantidad(-1, 'unidad', { permitirCero: true })).toMatch(/negativa/)
  })

  it('rechaza valores no finitos o fuera de numeric(12,3)', () => {
    expect(validarCantidad(Number.NaN, 'unidad')).toMatch(/no es válida/)
    expect(validarCantidad(1e10, 'unidad')).toMatch(/demasiado grande/)
  })
})

describe('tieneMaxTresDecimales', () => {
  it('tolera la representación binaria de valores comunes', () => {
    expect(tieneMaxTresDecimales(0.1 + 0.2)).toBe(true)
    expect(tieneMaxTresDecimales(1.0005)).toBe(false)
    expect(tieneMaxTresDecimales(2.675)).toBe(true)
    expect(tieneMaxTresDecimales(123456789.123)).toBe(true)
  })
})

describe('restarCantidades', () => {
  it('resta sin errores de coma flotante', () => {
    expect(restarCantidades(0.3, 0.1)).toBe(0.2)
    expect(restarCantidades(5, 7.25)).toBe(-2.25)
  })
})

describe('formatCantidad', () => {
  it('muestra tres decimales para libra y enteros para unidad', () => {
    expect(formatCantidad(1.5, 'libra')).toBe('1.500')
    expect(formatCantidad(12, 'unidad')).toBe('12')
  })
})

describe('dinero', () => {
  it('convierte dólares a centavos redondeando', () => {
    expect(dolaresACentavos(0.8)).toBe(80)
    expect(dolaresACentavos(1.005)).toBe(100)
    expect(dolaresACentavos(19.99)).toBe(1999)
  })

  it('formatea centavos como USD', () => {
    expect(formatUSD(1234)).toBe('$12.34')
  })
})

describe('esFechaValida', () => {
  it('acepta fechas reales y rechaza las inexistentes', async () => {
    const { esFechaValida } = await import('../shared/utils/fechas')
    expect(esFechaValida('2026-09-28')).toBe(true)
    expect(esFechaValida('2024-02-29')).toBe(true)
    expect(esFechaValida('2026-02-30')).toBe(false)
    expect(esFechaValida('2026-9-28')).toBe(false)
  })
})
