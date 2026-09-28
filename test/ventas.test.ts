import { describe, expect, it } from 'vitest'
import {
  calcularCobro,
  efectivoEsperado,
  subtotalLinea,
  totalVenta,
  validarMontoSalida
} from '../shared/utils/ventas'

describe('subtotalLinea', () => {
  it('multiplica precio por cantidad entera', () => {
    expect(subtotalLinea(125, 3)).toBe(375)
  })

  it('usa cantidades con decimales (1.500 lb × $0.80 = $1.20)', () => {
    expect(subtotalLinea(80, 1.5)).toBe(120)
  })

  it('redondea al centavo más cercano', () => {
    // 0.333 lb × $1.00 = 33.3 ¢ → 33 ¢
    expect(subtotalLinea(100, 0.333)).toBe(33)
    // 1.255 lb × $0.99 = 124.245 ¢ → 124 ¢
    expect(subtotalLinea(99, 1.255)).toBe(124)
    // 0.005 L × $1.00 = 0.5 ¢ → 1 ¢ (medio centavo hacia arriba)
    expect(subtotalLinea(100, 0.005)).toBe(1)
  })

  it('no arrastra errores de coma flotante', () => {
    // 0.1 × 3 en coma flotante es 0.30000000000000004
    expect(subtotalLinea(1000, 0.1 + 0.2)).toBe(300)
    expect(subtotalLinea(235, 1.1)).toBe(259) // 258.5 → 259
  })

  it('es exacto con valores grandes', () => {
    expect(subtotalLinea(100_000_000, 999_999.999)).toBe(99_999_999_900_000)
  })
})

describe('totalVenta', () => {
  it('suma los subtotales ya redondeados', () => {
    const subtotales = [subtotalLinea(100, 0.333), subtotalLinea(100, 0.333), subtotalLinea(100, 0.334)]
    expect(subtotales).toEqual([33, 33, 33])
    expect(totalVenta(subtotales)).toBe(99)
  })
})

describe('calcularCobro', () => {
  it('calcula el cambio en efectivo', () => {
    expect(calcularCobro(375, 'efectivo', 500)).toEqual({ montoRecibidoCentavos: 500, cambioCentavos: 125 })
    expect(calcularCobro(375, 'efectivo', 375)).toEqual({ montoRecibidoCentavos: 375, cambioCentavos: 0 })
  })

  it('rechaza efectivo insuficiente o faltante', () => {
    expect(calcularCobro(375, 'efectivo', 300)).toEqual({ error: 'El monto recibido no cubre el total.' })
    expect(calcularCobro(375, 'efectivo')).toEqual({ error: 'Ingresa el monto recibido.' })
  })

  it('con tarjeta o transferencia registra el total sin cambio', () => {
    expect(calcularCobro(375, 'tarjeta', 1000)).toEqual({ montoRecibidoCentavos: 375, cambioCentavos: 0 })
    expect(calcularCobro(375, 'transferencia')).toEqual({ montoRecibidoCentavos: 375, cambioCentavos: 0 })
  })
})

describe('efectivoEsperado', () => {
  it('es inicial + ventas en efectivo − salidas', () => {
    expect(efectivoEsperado({ montoInicialCentavos: 2000, ventasEfectivoCentavos: 1550, salidasCentavos: 500 })).toBe(3050)
  })

  it('sin movimientos es el monto inicial', () => {
    expect(efectivoEsperado({ montoInicialCentavos: 2000, ventasEfectivoCentavos: 0, salidasCentavos: 0 })).toBe(2000)
  })
})

describe('validarMontoSalida', () => {
  it('acepta montos hasta el efectivo esperado', () => {
    expect(validarMontoSalida(500, 3050)).toBeNull()
    expect(validarMontoSalida(3050, 3050)).toBeNull()
  })

  it('rechaza montos mayores que el esperado', () => {
    expect(validarMontoSalida(3051, 3050)).toMatch(/supera el efectivo disponible/)
  })

  it('rechaza cero, negativos y fracciones de centavo', () => {
    expect(validarMontoSalida(0, 3050)).toMatch(/mayor que cero/)
    expect(validarMontoSalida(-100, 3050)).toMatch(/mayor que cero/)
    expect(validarMontoSalida(10.5, 3050)).toMatch(/mayor que cero/)
  })
})
