import { and, isNotNull, lte, gte, lt, sql } from 'drizzle-orm'
import { stockTienda } from '../db/schema'

// Stock bajo: con mínimo definido y cantidad en o bajo el mínimo (sin llegar a negativo).
export const condicionStockBajo = and(
  isNotNull(stockTienda.stockMinimo),
  gte(stockTienda.cantidad, 0),
  lte(stockTienda.cantidad, sql`${stockTienda.stockMinimo}`)
)

// Stock por corregir: quedó negativo (se vendió sin stock suficiente).
export const condicionStockNegativo = lt(stockTienda.cantidad, 0)
