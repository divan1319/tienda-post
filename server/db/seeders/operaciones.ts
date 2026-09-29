import type { Aleatorio } from './aleatorio'
import { GASTOS_MENORES, MOTIVOS_ANULACION, PANADERIA, PRODUCTOS, PROVEEDORES, TIENDAS, vendedoraDelDia, type ClaveTienda, type ClaveUsuario, type Grupo } from './datos'
import type { Libro } from './libro'
import { ahoraLocal, diaSemana, hora, instante, sumarDias } from './tiempo'
import type { MetodoPago } from '../../../shared/utils/ventas'

export interface Contexto {
  libro: Libro
  rnd: Aleatorio
  dias: number
  tiendaIds: Record<ClaveTienda, number>
  userIds: Record<ClaveUsuario, string>
  /** productoId por índice de PRODUCTOS */
  productoIds: number[]
}

const APERTURA = hora(7)
const CIERRE = hora(19, 30)

/** Costo de compra aproximado: 72 % del precio de venta */
const costo = (precio: number) => Math.round(precio * 0.72)

/** Redondeo de cantidades según la unidad (enteros o medias libras/litros) */
function redondear(cantidad: number, unidad: string) {
  return unidad === 'unidad' ? Math.max(0, Math.round(cantidad)) : Math.max(0, Math.round(cantidad * 2) / 2)
}

function cantidadVendida(rnd: Aleatorio, nombre: string, unidad: string): number {
  if (nombre === 'Huevo') return rnd.elegir([1, 2, 3, 6, 6, 12])
  if (nombre === 'Pan francés') return rnd.elegir([2, 4, 5, 6, 10])
  if (nombre.startsWith('Queso')) return rnd.elegir([0.25, 0.5, 0.5, 1])
  if (unidad === 'libra') return rnd.elegir([0.5, 1, 1, 1, 1.5, 2, 2, 3, 5])
  if (unidad === 'litro') return rnd.elegir([0.5, 1, 1, 2])
  return rnd.ponderado([1, 2, 3, 4], n => [60, 25, 10, 5][n - 1]!)
}

/** Monto recibido en efectivo: exacto o redondeado al billete siguiente */
function montoRecibido(rnd: Aleatorio, total: number): number {
  const opciones = [total, ...[100, 500, 1000, 2000].map(b => Math.ceil(total / b) * b)]
  return rnd.ponderado(opciones, m => (m === total ? 3 : m - total > 1500 ? 1 : 2))
}

function metodoPago(rnd: Aleatorio): MetodoPago {
  return rnd.ponderado(['efectivo', 'tarjeta', 'transferencia'] as const, m => ({ efectivo: 65, tarjeta: 25, transferencia: 10 })[m])
}

/** Productos (índice en PRODUCTOS) del grupo de un pedido */
const indicesDelGrupo = (grupo: Grupo) => PRODUCTOS.map((p, i) => ({ p, i })).filter(x => x.p.grupo === grupo).map(x => x.i)

export function simularOperaciones(ctx: Contexto) {
  const { libro, rnd, tiendaIds, userIds, productoIds } = ctx
  const { hoy, minutos: ahora } = ahoraLocal()
  const inicio = sumarDias(hoy, -ctx.dias)
  const admin = userIds.admin
  let numeroFactura = 1000

  /** true si el evento del día `fecha` a la hora `min` ya ocurrió */
  const ocurrio = (fecha: string, min: number) => fecha < hoy || (fecha === hoy && min <= ahora)

  for (const t of TIENDAS) {
    const tiendaId = tiendaIds[t.clave]
    // Inventario inicial, el día anterior al primer turno
    libro.entrada(tiendaId, admin, instante(sumarDias(inicio, -1), hora(17)), 'Inventario inicial', PRODUCTOS.map((p, i) => ({
      productoId: productoIds[i]!,
      cantidad: redondear(p.objetivo * t.escalaStock, p.unidad)
    })))
  }

  for (let d = 0; d <= ctx.dias; d++) {
    const fecha = sumarDias(inicio, d)
    const dia = diaSemana(fecha)

    for (const t of TIENDAS) {
      const tiendaId = tiendaIds[t.clave]
      if (!ocurrio(fecha, APERTURA)) continue

      // ----- Apertura -----
      const vendedora = userIds[vendedoraDelDia(t.clave, dia)]
      libro.abrirTurno(tiendaId, vendedora, instante(fecha, APERTURA), rnd.elegir([2000, 2500, 3000, 4000]))

      // ----- Pan del día (07:45): compra directa pagada con la caja + entrada -----
      if (ocurrio(fecha, hora(7, 45))) {
        const lineas = indicesDelGrupo('pan').map(i => ({
          productoId: productoIds[i]!,
          cantidad: redondear(PRODUCTOS[i]!.objetivo * t.escalaStock - libro.stock(tiendaId, productoIds[i]!), 'unidad')
        })).filter(l => l.cantidad > 0)
        const total = lineas.reduce((s, l) => s + l.cantidad * costo(libro.producto(l.productoId).precio), 0)
        if (lineas.length && total > 0) {
          const at = instante(fecha, hora(7, 45))
          const compraId = libro.compra({ tiendaId, tipo: 'directa', nombre: 'Pan del día', proveedor: PANADERIA, totalCentavos: total, numeroFactura: null, fechaCompra: fecha, userId: admin, createdAt: at })
          libro.salida(tiendaId, admin, at, total, `Compra: Pan del día`, compraId)
          libro.entrada(tiendaId, admin, at, 'Pan del día', lineas)
        }
      }

      // ----- Pedido semanal (se hace 3 días antes y se recibe a las 08:15) -----
      for (const grupo of ['secos', 'frescos'] as const) {
        const prov = PROVEEDORES[grupo]
        if (dia !== prov.dia) continue
        const pedidoId = libro.pedido({
          tiendaId,
          nombre: prov.pedido,
          proveedor: prov.proveedor,
          fechaEsperada: fecha,
          estado: 'pendiente',
          nota: null,
          userId: admin,
          createdAt: instante(sumarDias(fecha, -3), hora(10))
        })
        if (!ocurrio(fecha, hora(8, 30))) continue

        const lineas = indicesDelGrupo(grupo)
          // En Norte, la bebida energizante no se repone en las últimas dos semanas:
          // queda en negativo y aparece en «Stock por corregir»
          .filter(i => !(t.clave === 'norte' && PRODUCTOS[i]!.nombre === 'Bebida energizante' && fecha > sumarDias(hoy, -14)))
          .map(i => ({
            productoId: productoIds[i]!,
            cantidad: redondear(PRODUCTOS[i]!.objetivo * t.escalaStock - libro.stock(tiendaId, productoIds[i]!), PRODUCTOS[i]!.unidad)
          }))
          .filter(l => l.cantidad > 0)
        if (!lineas.length) continue

        const at = instante(fecha, hora(8, 15))
        const total = lineas.reduce((s, l) => s + Math.round(l.cantidad * costo(libro.producto(l.productoId).precio)), 0)
        libro.pedidos[pedidoId - 1]!.estado = 'recibido'
        libro.compra({ tiendaId, tipo: 'pedido', pedidoId, nombre: prov.pedido, proveedor: prov.proveedor, totalCentavos: total, numeroFactura: `F-${++numeroFactura}`, fechaCompra: fecha, userId: admin, createdAt: at })
        libro.entrada(tiendaId, admin, instante(fecha, hora(8, 30)), `Pedido: ${prov.pedido}`, lineas)
      }

      // ----- Ventas del día -----
      const factorDia = dia === 6 ? 1.3 : dia === 0 ? 0.7 : 1
      const cantidadVentas = Math.round(t.ventasPorDia * factorDia * (0.8 + rnd.siguiente() * 0.4))
      const horas = Array.from({ length: cantidadVentas }, () => rnd.entero(hora(7, 5), hora(19, 10))).sort((a, b) => a - b)
      const hielo = rnd.probabilidad(0.12) ? hora(11) : null
      const gasto = rnd.probabilidad(0.15) ? hora(15) : null
      let gastoHecho = false
      let hieloHecho = false

      for (const min of horas) {
        if (!ocurrio(fecha, min)) break

        // Compra de hielo pagada con la caja (a media mañana, si alcanza el efectivo)
        if (hielo && !hieloHecho && min >= hielo) {
          hieloHecho = true
          const idx = PRODUCTOS.findIndex(p => p.nombre === 'Bolsa de hielo')
          const cantidad = rnd.entero(5, 10)
          const total = cantidad * costo(PRODUCTOS[idx]!.precio)
          const at = instante(fecha, hielo)
          if (libro.esperado(tiendaId) >= total) {
            const compraId = libro.compra({ tiendaId, tipo: 'directa', nombre: 'Bolsas de hielo', proveedor: null, totalCentavos: total, numeroFactura: null, fechaCompra: fecha, userId: admin, createdAt: at })
            libro.salida(tiendaId, admin, at, total, 'Compra: Bolsas de hielo', compraId)
            libro.entrada(tiendaId, admin, at, 'Bolsas de hielo', [{ productoId: productoIds[idx]!, cantidad }])
          }
        }

        // Gasto menor (salida suelta de efectivo)
        if (gasto && !gastoHecho && min >= gasto) {
          gastoHecho = true
          const g = rnd.elegir(GASTOS_MENORES)
          libro.salida(tiendaId, admin, instante(fecha, gasto), g.monto, g.motivo)
        }

        const nLineas = rnd.ponderado([1, 2, 3, 4], n => [45, 30, 17, 8][n - 1]!)
        const elegidos = new Set<number>()
        while (elegidos.size < nLineas) {
          elegidos.add(PRODUCTOS.indexOf(rnd.ponderado(PRODUCTOS, p => p.demanda)))
        }
        const lineas = [...elegidos].map(i => ({
          productoId: productoIds[i]!,
          cantidad: cantidadVendida(rnd, PRODUCTOS[i]!.nombre, PRODUCTOS[i]!.unidad)
        }))
        const at = instante(fecha, min)
        const ventaId = libro.venta(tiendaId, at, lineas, metodoPago(rnd), total => montoRecibido(rnd, total))

        // Anulación ocasional por el admin, poco después y antes del cierre
        const minAnula = min + rnd.entero(5, 45)
        if (ventaId && rnd.probabilidad(0.015) && minAnula < CIERRE && ocurrio(fecha, minAnula)) {
          libro.anular(ventaId, admin, instante(fecha, minAnula), rnd.elegir(MOTIVOS_ANULACION))
        }
      }

      // ----- Conteo físico cada dos semanas (18:00): ajusta dos productos -----
      if (d % 14 === 7 && ocurrio(fecha, hora(18))) {
        for (const i of rnd.muestra(PRODUCTOS.map((_, k) => k), 2)) {
          const p = PRODUCTOS[i]!
          const actual = libro.stock(tiendaId, productoIds[i]!)
          const faltante = p.unidad === 'unidad' ? rnd.entero(0, 2) : rnd.elegir([0, 0.5, 1])
          libro.ajuste(tiendaId, productoIds[i]!, 'conteo', Math.max(0, redondear(actual - faltante, p.unidad === 'unidad' ? 'unidad' : 'libra')), 'Conteo físico quincenal', admin, instante(fecha, hora(18)))
        }
      }

      // ----- Merma semanal de lácteos vencidos (domingo 18:30) -----
      if (dia === 0 && ocurrio(fecha, hora(18, 30))) {
        const idx = PRODUCTOS.findIndex(p => p.nombre === 'Crema 250 ml')
        if (libro.stock(tiendaId, productoIds[idx]!) >= 2) {
          libro.ajuste(tiendaId, productoIds[idx]!, 'salida', rnd.entero(1, 2), 'Producto vencido', admin, instante(fecha, hora(18, 30)))
        }
      }

      // ----- Cierre (19:30): la mayoría cuadra; a veces falta o sobra algo -----
      if (ocurrio(fecha, CIERRE)) {
        const diferencia = rnd.ponderado([0, -25, -50, -100, 25, 50], x => (x === 0 ? 80 : 4))
        libro.cerrarTurno(tiendaId, instante(fecha, CIERRE), diferencia, diferencia < 0 ? 'Faltó efectivo al contar' : diferencia > 0 ? 'Sobró efectivo al contar' : null)
      }
    }
  }

  // ----- Pedidos pendientes para el panel: próximos, uno de hoy, uno atrasado y un cancelado -----
  for (const t of TIENDAS) {
    const tiendaId = tiendaIds[t.clave]
    for (let k = 1; k <= 7; k++) {
      const fecha = sumarDias(hoy, k)
      for (const grupo of ['secos', 'frescos'] as const) {
        const prov = PROVEEDORES[grupo]
        if (diaSemana(fecha) !== prov.dia) continue
        libro.pedido({ tiendaId, nombre: prov.pedido, proveedor: prov.proveedor, fechaEsperada: fecha, estado: 'pendiente', nota: null, userId: admin, createdAt: instante(sumarDias(hoy, -1), hora(10)) })
      }
    }
  }
  const creado = instante(sumarDias(hoy, -3), hora(9))
  libro.pedido({ tiendaId: tiendaIds.norte, nombre: 'Huevos (pedido extra)', proveedor: 'Granja El Porvenir', fechaEsperada: hoy, estado: 'pendiente', nota: 'Confirmar cantidad antes de recibir', userId: admin, createdAt: creado })
  libro.pedido({ tiendaId: tiendaIds.centro, nombre: 'Productos de limpieza industrial', proveedor: 'Químicos del Sur', fechaEsperada: sumarDias(hoy, -2), estado: 'pendiente', nota: 'El proveedor no llegó; llamar', userId: admin, createdAt: instante(sumarDias(hoy, -6), hora(9)) })
  libro.pedido({ tiendaId: tiendaIds.norte, nombre: 'Refrescos de temporada', proveedor: 'Distribuidora Occidente', fechaEsperada: sumarDias(hoy, -20), estado: 'cancelado', nota: 'Se canceló por precio', userId: admin, createdAt: instante(sumarDias(hoy, -25), hora(9)) })

  // Compra directa sin pagar con caja (la pagó el admin)
  libro.compra({ tiendaId: tiendaIds.centro, tipo: 'directa', nombre: 'Mantenimiento del refrigerador', proveedor: 'Refrigeración Técnica', totalCentavos: 3500, numeroFactura: 'R-0451', fechaCompra: sumarDias(hoy, -10), userId: admin, createdAt: instante(sumarDias(hoy, -10), hora(14)) })
}
