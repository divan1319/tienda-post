// Dinero siempre en centavos enteros; se formatea como USD solo en la interfaz.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatUSD(centavos: number): string {
  return usd.format(centavos / 100)
}

export function dolaresACentavos(dolares: number): number {
  return Math.round(dolares * 100)
}

export function centavosADolares(centavos: number): number {
  return centavos / 100
}
