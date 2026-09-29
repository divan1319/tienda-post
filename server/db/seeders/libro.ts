import type {
  compra,
  entradaInventario,
  entradaInventarioDetalle,
  movimientoInventario,
  pedido,
  salidaCaja,
  turnoCaja,
  venta,
  ventaDetalle
} from '../schema'
import { aMilesimas, deMilesimas, type UnidadMedida } from '../../../shared/utils/cantidad'
import { calcularCobro, efectivoEsperado, subtotalLinea, totalVenta, validarMontoSalida, type MetodoPago } from '../../../shared/utils/ventas'

// Libro en memoria de todas las operaciones de la demo. Aplica las mismas reglas que
// la app (cada cambio de stock escribe su movimiento, correlativo por tienda, efectivo
// esperado, salidas que no superan la caja…) y al final se inserta todo por lotes.

export interface ProductoLibro {
  id: number
  nombre: string
  unidad: UnidadMedida
  precio: number
}

type Movimiento = typeof movimientoInventario.$inferInsert

interface TurnoAbierto {
  id: number
  tiendaId: number
  userId: string
  inicial: number
  ventasEfectivo: number
  salidas: number
}

export class Libro {
  readonly movimientos: Movimiento[] = []
  readonly entradas: (typeof entradaInventario.$inferInsert)[] = []
  readonly entradasDetalle: (typeof entradaInventarioDetalle.$inferInsert)[] = []
  readonly turnos: (typeof turnoCaja.$inferInsert)[] = []
  readonly ventas: (typeof venta.$inferInsert)[] = []
  readonly ventasDetalle: (typeof ventaDetalle.$inferInsert)[] = []
  readonly salidas: (typeof salidaCaja.$inferInsert)[] = []
  readonly pedidos: (typeof pedido.$inferInsert)[] = []
  readonly compras: (typeof compra.$inferInsert)[] = []

  /** Stock en milésimas por `tiendaId:productoId` */
  private readonly stockMil = new Map<string, number>()
  readonly correlativos = new Map<number, number>()
  private readonly abiertos = new Map<number, TurnoAbierto>()
  private readonly productos = new Map<number, ProductoLibro>()

  constructor(productos: ProductoLibro[]) {
    for (const p of productos) this.productos.set(p.id, p)
  }

  producto(id: number) {
    return this.productos.get(id)!
  }

  stock(tiendaId: number, productoId: number): number {
    return deMilesimas(this.stockMil.get(`${tiendaId}:${productoId}`) ?? 0)
  }

  /** Stock final de todas las filas (para stock_tienda) */
  stockFinal() {
    return [...this.stockMil].map(([clave, mil]) => {
      const [tiendaId, productoId] = clave.split(':').map(Number)
      return { tiendaId: tiendaId!, productoId: productoId!, cantidad: deMilesimas(mil) }
    })
  }

  // ---------- Inventario ----------

  private mover(m: Omit<Movimiento, 'id'>): number {
    const clave = `${m.tiendaId}:${m.productoId}`
    const saldo = (this.stockMil.get(clave) ?? 0) + aMilesimas(m.cantidad)
    this.stockMil.set(clave, saldo)
    this.movimientos.push(m)
    return deMilesimas(saldo)
  }

  entrada(tiendaId: number, userId: string, at: Date, nota: string | null, lineas: { productoId: number, cantidad: number }[]) {
    const lineasValidas = lineas.filter(l => l.cantidad > 0)
    if (!lineasValidas.length) return null
    const id = this.entradas.length + 1
    this.entradas.push({ id, tiendaId, userId, nota, createdAt: at })
    for (const l of [...lineasValidas].sort((a, b) => a.productoId - b.productoId)) {
      this.entradasDetalle.push({ entradaId: id, productoId: l.productoId, cantidad: l.cantidad })
      this.mover({ tiendaId, productoId: l.productoId, tipo: 'entrada', cantidad: l.cantidad, referenciaTipo: 'entrada', referenciaId: id, userId, nota, createdAt: at })
    }
    return id
  }

  /** Ajuste: `conteo` deja el stock en la cantidad contada; `salida` / `entrada` restan o suman. */
  ajuste(tiendaId: number, productoId: number, modo: 'conteo' | 'salida' | 'entrada', cantidad: number, motivo: string, userId: string, at: Date) {
    const delta = modo === 'conteo'
      ? deMilesimas(aMilesimas(cantidad) - aMilesimas(this.stock(tiendaId, productoId)))
      : modo === 'salida' ? -cantidad : cantidad
    if (delta === 0) return
    this.mover({ tiendaId, productoId, tipo: 'ajuste', cantidad: delta, referenciaTipo: modo, referenciaId: null, userId, nota: motivo, createdAt: at })
  }

  // ---------- Caja ----------

  turnoAbierto(tiendaId: number) {
    return this.abiertos.get(tiendaId) ?? null
  }

  abrirTurno(tiendaId: number, userId: string, at: Date, inicial: number) {
    const id = this.turnos.length + 1
    this.turnos.push({ id, tiendaId, userId, abiertoAt: at, montoInicialCentavos: inicial })
    this.abiertos.set(tiendaId, { id, tiendaId, userId, inicial, ventasEfectivo: 0, salidas: 0 })
    return id
  }

  esperado(tiendaId: number): number {
    const t = this.abiertos.get(tiendaId)
    if (!t) return 0
    return efectivoEsperado({ montoInicialCentavos: t.inicial, ventasEfectivoCentavos: t.ventasEfectivo, salidasCentavos: t.salidas })
  }

  /** Salida de efectivo del turno abierto; false si no hay turno o no alcanza la caja. */
  salida(tiendaId: number, userId: string, at: Date, monto: number, motivo: string, compraId: number | null = null): boolean {
    const t = this.abiertos.get(tiendaId)
    if (!t || validarMontoSalida(monto, this.esperado(tiendaId))) return false
    t.salidas += monto
    this.salidas.push({ id: this.salidas.length + 1, turnoId: t.id, tiendaId, userId: userId, montoCentavos: monto, motivo, compraId, createdAt: at })
    return true
  }

  cerrarTurno(tiendaId: number, at: Date, diferencia: number, nota: string | null = null) {
    const t = this.abiertos.get(tiendaId)
    if (!t) return
    const esperado = this.esperado(tiendaId)
    const contado = Math.max(0, esperado + diferencia)
    Object.assign(this.turnos[t.id - 1]!, {
      cerradoAt: at,
      efectivoEsperadoCentavos: esperado,
      efectivoContadoCentavos: contado,
      diferenciaCentavos: contado - esperado,
      nota
    })
    this.abiertos.delete(tiendaId)
  }

  // ---------- Ventas ----------

  venta(tiendaId: number, at: Date, lineas: { productoId: number, cantidad: number }[], metodo: MetodoPago, recibir: (total: number) => number) {
    const t = this.abiertos.get(tiendaId)
    if (!t || !lineas.length) return null

    const detalle = lineas.map((l) => {
      const p = this.producto(l.productoId)
      return {
        productoId: p.id,
        nombreProducto: p.nombre,
        unidadMedida: p.unidad,
        precioUnitarioCentavos: p.precio,
        cantidad: l.cantidad,
        subtotalCentavos: subtotalLinea(p.precio, l.cantidad)
      }
    })
    const total = totalVenta(detalle.map(d => d.subtotalCentavos))
    const cobro = calcularCobro(total, metodo, metodo === 'efectivo' ? recibir(total) : null)
    if ('error' in cobro) throw new Error(`[seed] cobro inválido: ${cobro.error}`)

    const id = this.ventas.length + 1
    const correlativo = (this.correlativos.get(tiendaId) ?? 0) + 1
    this.correlativos.set(tiendaId, correlativo)

    let sinStock = false
    for (const d of [...detalle].sort((a, b) => a.productoId - b.productoId)) {
      this.ventasDetalle.push({ ventaId: id, ...d })
      const saldo = this.mover({ tiendaId, productoId: d.productoId, tipo: 'venta', cantidad: -d.cantidad, referenciaTipo: 'venta', referenciaId: id, userId: t.userId, nota: null, createdAt: at })
      if (saldo < 0) sinStock = true
    }

    this.ventas.push({
      id,
      tiendaId,
      turnoId: t.id,
      correlativo,
      userId: t.userId,
      totalCentavos: total,
      metodoPago: metodo,
      montoRecibidoCentavos: cobro.montoRecibidoCentavos,
      cambioCentavos: cobro.cambioCentavos,
      estado: 'completada',
      conStockInsuficiente: sinStock,
      createdAt: at
    })
    if (metodo === 'efectivo') t.ventasEfectivo += total
    return id
  }

  /** Anula una venta del turno abierto: devuelve el stock y deja de sumar en la caja. */
  anular(ventaId: number, adminId: string, at: Date, motivo: string) {
    const v = this.ventas[ventaId - 1]!
    const t = this.abiertos.get(v.tiendaId)
    if (v.estado === 'anulada' || !t || t.id !== v.turnoId) return false
    Object.assign(v, { estado: 'anulada', anuladaPor: adminId, anuladaAt: at, motivoAnulacion: motivo })
    for (const d of this.ventasDetalle.filter(x => x.ventaId === ventaId)) {
      this.mover({ tiendaId: v.tiendaId, productoId: d.productoId, tipo: 'anulacion_venta', cantidad: d.cantidad, referenciaTipo: 'venta', referenciaId: ventaId, userId: adminId, nota: motivo, createdAt: at })
    }
    if (v.metodoPago === 'efectivo') t.ventasEfectivo -= v.totalCentavos
    return true
  }

  // ---------- Pedidos y compras ----------

  pedido(datos: Omit<typeof pedido.$inferInsert, 'id'>) {
    const id = this.pedidos.length + 1
    this.pedidos.push({ id, ...datos })
    return id
  }

  compra(datos: Omit<typeof compra.$inferInsert, 'id'>) {
    const id = this.compras.length + 1
    this.compras.push({ id, ...datos })
    return id
  }
}
