// Generador pseudoaleatorio con semilla (mulberry32): los mismos datos en cada corrida.

export class Aleatorio {
  private estado: number

  constructor(semilla = 20260929) {
    this.estado = semilla >>> 0
  }

  /** Número en [0, 1) */
  siguiente(): number {
    this.estado = (this.estado + 0x6D2B79F5) >>> 0
    let t = this.estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Entero en [min, max] */
  entero(min: number, max: number): number {
    return min + Math.floor(this.siguiente() * (max - min + 1))
  }

  /** true con probabilidad p */
  probabilidad(p: number): boolean {
    return this.siguiente() < p
  }

  elegir<T>(lista: readonly T[]): T {
    return lista[Math.floor(this.siguiente() * lista.length)]!
  }

  /** Elige según pesos relativos */
  ponderado<T>(lista: readonly T[], peso: (x: T) => number): T {
    const total = lista.reduce((s, x) => s + peso(x), 0)
    let r = this.siguiente() * total
    for (const x of lista) {
      r -= peso(x)
      if (r < 0) return x
    }
    return lista[lista.length - 1]!
  }

  /** `n` elementos distintos */
  muestra<T>(lista: readonly T[], n: number): T[] {
    const copia = [...lista]
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(this.siguiente() * (i + 1))
      ;[copia[i], copia[j]] = [copia[j]!, copia[i]!]
    }
    return copia.slice(0, n)
  }
}
