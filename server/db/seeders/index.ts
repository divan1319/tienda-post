import { count, eq, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { Db } from '../index'
import * as s from '../schema'
import type { Auth } from '../../lib/auth'
import { Aleatorio } from './aleatorio'
import { CATEGORIAS, CONTRASENA_DEMO, MINIMOS_ALTOS, PRODUCTOS, TIENDAS, USUARIOS, codigoInterno, type ClaveTienda, type ClaveUsuario } from './datos'
import { Libro } from './libro'
import { simularOperaciones } from './operaciones'

export interface OpcionesDemo {
  /** Días de historia hacia atrás desde hoy */
  dias?: number
  semilla?: number
  log?: (mensaje: string) => void
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

async function insertarPorLotes<T extends PgTable>(tx: Tx, tabla: T, filas: T['$inferInsert'][], lote = 500) {
  for (let i = 0; i < filas.length; i += lote) {
    await tx.insert(tabla).values(filas.slice(i, i + lote))
  }
}

// Tablas con id serial a las que se insertan ids explícitos: al final se ajusta la secuencia
const TABLAS_CON_SERIAL = ['tienda', 'categoria', 'producto', 'entrada_inventario', 'turno_caja', 'venta', 'salida_caja', 'pedido', 'compra', 'movimiento_inventario']

/**
 * Carga datos de demostración en una base vacía (recién migrada con `pnpm db:fresh`).
 * Todo lo operativo se inserta en una sola transacción.
 */
export async function sembrarDemo(db: Db, auth: Auth, opciones: OpcionesDemo = {}) {
  const log = opciones.log ?? console.log
  const dias = opciones.dias ?? 60
  const rnd = new Aleatorio(opciones.semilla)

  const [[tiendas], [usuarios]] = await Promise.all([
    db.select({ n: count() }).from(s.tienda),
    db.select({ n: count() }).from(s.user)
  ])
  if (tiendas!.n > 0 || usuarios!.n > 0) {
    throw new Error('La base no está vacía. Corre `pnpm db:fresh --seed` para empezar de cero.')
  }

  // ---------- Tiendas, categorías y productos ----------
  log('Tiendas, categorías y productos…')
  const tiendaIds = Object.fromEntries(TIENDAS.map((t, i) => [t.clave, i + 1])) as Record<ClaveTienda, number>
  await db.insert(s.tienda).values(TIENDAS.map((t, i) => ({ id: i + 1, nombre: t.nombre, direccion: t.direccion })))

  const categoriaIds = new Map<string, number>(CATEGORIAS.map((c, i) => [c, i + 1]))
  await db.insert(s.categoria).values(CATEGORIAS.map((c, i) => ({ id: i + 1, nombre: c })))

  let codigo = 0
  const productoIds = PRODUCTOS.map((_, i) => i + 1)
  await db.insert(s.producto).values(PRODUCTOS.map((p, i) => ({
    id: i + 1,
    nombre: p.nombre,
    codigoBarras: p.conCodigo ? codigoInterno(++codigo) : null,
    categoriaId: p.categoria ? categoriaIds.get(p.categoria)! : null,
    unidadMedida: p.unidad,
    precioVentaCentavos: p.precio
  })))

  // ---------- Usuarios (con Better Auth, igual que la app) ----------
  log('Usuarios…')
  const userIds = {} as Record<ClaveUsuario, string>
  for (const u of USUARIOS) {
    const { user } = await auth.api.createUser({
      body: { email: u.email, name: u.nombre, password: CONTRASENA_DEMO, role: u.rol }
    })
    userIds[u.clave] = user.id
  }

  // ---------- Simulación de operaciones ----------
  log(`Simulando ${dias} días de operación…`)
  const libro = new Libro(PRODUCTOS.map((p, i) => ({ id: productoIds[i]!, nombre: p.nombre, unidad: p.unidad, precio: p.precio })))
  simularOperaciones({ libro, rnd, dias, tiendaIds, userIds, productoIds })

  // Los movimientos se insertan en orden cronológico (el kardex ordena por fecha e id)
  const movimientos = [...libro.movimientos]
    .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())
    .map((m, i) => ({ ...m, id: i + 1 }))

  const minimos = new Map<string, number>()
  for (const t of TIENDAS) {
    PRODUCTOS.forEach((p, i) => {
      const minimo = p.unidad === 'unidad' ? Math.round(p.minimo * t.escalaStock) : Math.round(p.minimo * t.escalaStock * 2) / 2
      minimos.set(`${tiendaIds[t.clave]}:${productoIds[i]}`, minimo)
    })
    // Mínimo más exigente que el stock actual: estos productos aparecen en «Stock bajo»
    for (const nombre of MINIMOS_ALTOS[t.clave]) {
      const i = PRODUCTOS.findIndex(p => p.nombre === nombre)
      const actual = libro.stock(tiendaIds[t.clave], productoIds[i]!)
      const minimo = PRODUCTOS[i]!.unidad === 'unidad' ? Math.ceil(actual * 1.25) + 2 : Math.ceil(actual * 1.25 * 2) / 2 + 1
      minimos.set(`${tiendaIds[t.clave]}:${productoIds[i]}`, minimo)
    }
  }

  // ---------- Guardado ----------
  log('Guardando…')
  await db.transaction(async (tx) => {
    const asignaciones = USUARIOS.flatMap(u => u.tiendas.map(t => ({ userId: userIds[u.clave], tiendaId: tiendaIds[t] })))
    await tx.insert(s.usuarioTienda).values(asignaciones)
    for (const [clave, tienda] of [['admin', 'centro'], ['ana', 'centro'], ['maria', 'norte'], ['lucia', 'centro']] as const) {
      await tx.update(s.user).set({ tiendaActivaId: tiendaIds[tienda] }).where(eq(s.user.id, userIds[clave]))
    }

    await insertarPorLotes(tx, s.stockTienda, libro.stockFinal().map(f => ({
      ...f,
      stockMinimo: minimos.get(`${f.tiendaId}:${f.productoId}`) ?? null
    })))
    await insertarPorLotes(tx, s.entradaInventario, libro.entradas)
    await insertarPorLotes(tx, s.entradaInventarioDetalle, libro.entradasDetalle)
    await insertarPorLotes(tx, s.turnoCaja, libro.turnos)
    await insertarPorLotes(tx, s.venta, libro.ventas)
    await insertarPorLotes(tx, s.ventaDetalle, libro.ventasDetalle)
    await insertarPorLotes(tx, s.pedido, libro.pedidos)
    await insertarPorLotes(tx, s.compra, libro.compras)
    await insertarPorLotes(tx, s.salidaCaja, libro.salidas)
    await insertarPorLotes(tx, s.movimientoInventario, movimientos)

    for (const [tiendaId, correlativo] of libro.correlativos) {
      await tx.update(s.tienda).set({ ultimoCorrelativo: correlativo }).where(eq(s.tienda.id, tiendaId))
    }
    for (const tabla of TABLAS_CON_SERIAL) {
      await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('"${tabla}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tabla}"), 1), (SELECT MAX(id) FROM "${tabla}") IS NOT NULL)`))
    }
  })

  await verificar(db)

  return {
    ventas: libro.ventas.length,
    anuladas: libro.ventas.filter(v => v.estado === 'anulada').length,
    turnos: libro.turnos.length,
    abiertos: libro.turnos.filter(t => !t.cerradoAt).length,
    compras: libro.compras.length,
    pedidos: libro.pedidos.length,
    pendientes: libro.pedidos.filter(p => p.estado === 'pendiente').length,
    movimientos: movimientos.length,
    usuarios: USUARIOS.map(u => ({ nombre: u.nombre, email: u.email, rol: u.rol, contrasena: CONTRASENA_DEMO }))
  }
}

/** Comprueba en la base las reglas que la app asume; lanza un error si alguna falla. */
async function verificar(db: Db) {
  const consultas: [string, string][] = [
    ['stock distinto de la suma de sus movimientos', `
      SELECT count(*) FROM stock_tienda s
      WHERE s.cantidad <> (SELECT coalesce(sum(m.cantidad), 0) FROM movimiento_inventario m WHERE m.tienda_id = s.tienda_id AND m.producto_id = s.producto_id)`],
    ['turnos cerrados con esperado mal calculado', `
      SELECT count(*) FROM turno_caja t
      WHERE t.cerrado_at IS NOT NULL AND t.efectivo_esperado_centavos <> t.monto_inicial_centavos
        + (SELECT coalesce(sum(v.total_centavos), 0) FROM venta v WHERE v.turno_id = t.id AND v.estado = 'completada' AND v.metodo_pago = 'efectivo')
        - (SELECT coalesce(sum(x.monto_centavos), 0) FROM salida_caja x WHERE x.turno_id = t.id)`],
    ['ventas cuyo total no es la suma de sus subtotales', `
      SELECT count(*) FROM venta v
      WHERE v.total_centavos <> (SELECT sum(d.subtotal_centavos) FROM venta_detalle d WHERE d.venta_id = v.id)`],
    ['salidas que pagan una compra con monto distinto al total', `
      SELECT count(*) FROM salida_caja x JOIN compra c ON c.id = x.compra_id WHERE x.monto_centavos <> c.total_centavos`],
    ['correlativos repetidos o fuera de secuencia', `
      SELECT count(*) FROM tienda t
      WHERE t.ultimo_correlativo <> (SELECT count(*) FROM venta v WHERE v.tienda_id = t.id)`]
  ]
  for (const [descripcion, consulta] of consultas) {
    const res = await db.execute(sql.raw(consulta)) as unknown as { rows: { count: string | number }[] }
    const n = Number(res.rows[0]?.count ?? 0)
    if (n > 0) throw new Error(`[seed] Verificación fallida: ${n} ${descripcion}`)
  }
}
