import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  numeric,
  index,
  primaryKey,
  check,
  uniqueIndex
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { UNIDADES_MEDIDA } from '../../shared/utils/cantidad'
import { METODOS_PAGO } from '../../shared/utils/ventas'

// Todas las fechas se guardan como timestamptz (ver docs/PLAN.md, "Reglas generales").
const timestamptz = (name: string) => timestamp(name, { withTimezone: true })

// Cantidades: numeric(12,3) leído como number (hasta 9 enteros + 3 decimales cabe
// sin pérdida en un double). Las sumas de stock se hacen en SQL.
const cantidad = (name: string) => numeric(name, { precision: 12, scale: 3, mode: 'number' })

// ==========================================
// TIENDAS
// ==========================================

export const tienda = pgTable('tienda', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  direccion: text('direccion'),
  activa: boolean('activa').notNull().default(true),
  // Numera las ventas por tienda (se incrementa con UPDATE … RETURNING)
  ultimoCorrelativo: integer('ultimo_correlativo').notNull().default(0),
  createdAt: timestamptz('created_at').notNull().defaultNow()
})

// ==========================================
// BETTER AUTH (+ plugin admin + tiendaActivaId)
// ==========================================

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  // Plugin admin: 'admin' | 'vendedora'
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamptz('ban_expires'),
  // Campo adicional (user.additionalFields, input: false)
  tiendaActivaId: integer('tienda_activa_id').references(() => tienda.id, { onDelete: 'set null' })
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamptz('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Plugin admin
  impersonatedBy: text('impersonated_by')
}, t => [
  index('session_user_id_idx').on(t.userId)
])

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamptz('access_token_expires_at'),
  refreshTokenExpiresAt: timestamptz('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow()
}, t => [
  index('account_user_id_idx').on(t.userId)
])

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamptz('expires_at').notNull(),
  createdAt: timestamptz('created_at').defaultNow(),
  updatedAt: timestamptz('updated_at').defaultNow()
}, t => [
  index('verification_identifier_idx').on(t.identifier)
])

// ==========================================
// ASIGNACIÓN DE TIENDAS
// ==========================================

export const usuarioTienda = pgTable('usuario_tienda', {
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  tiendaId: integer('tienda_id')
    .notNull()
    .references(() => tienda.id)
}, t => [
  primaryKey({ columns: [t.userId, t.tiendaId] }),
  index('usuario_tienda_tienda_id_idx').on(t.tiendaId)
])

// ==========================================
// CATÁLOGO
// ==========================================

export const unidadMedida = pgEnum('unidad_medida', UNIDADES_MEDIDA)

export const categoria = pgTable('categoria', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  activa: boolean('activa').notNull().default(true)
})

export const producto = pgTable('producto', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  codigoBarras: text('codigo_barras').unique(),
  categoriaId: integer('categoria_id').references(() => categoria.id),
  // El precio es por esta unidad y es el mismo en todas las tiendas
  unidadMedida: unidadMedida('unidad_medida').notNull().default('unidad'),
  precioVentaCentavos: integer('precio_venta_centavos').notNull(),
  fotoKey: text('foto_key'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow()
}, t => [
  check('producto_precio_no_negativo', sql`${t.precioVentaCentavos} >= 0`),
  index('producto_categoria_id_idx').on(t.categoriaId)
])

// ==========================================
// INVENTARIO
// ==========================================

export const stockTienda = pgTable('stock_tienda', {
  tiendaId: integer('tienda_id').notNull().references(() => tienda.id),
  productoId: integer('producto_id').notNull().references(() => producto.id),
  // Puede quedar negativa (se permite vender sin stock suficiente)
  cantidad: cantidad('cantidad').notNull().default(0),
  stockMinimo: cantidad('stock_minimo')
}, t => [
  primaryKey({ columns: [t.tiendaId, t.productoId] })
])

export const tipoMovimiento = pgEnum('tipo_movimiento', ['entrada', 'venta', 'anulacion_venta', 'ajuste'])

export const movimientoInventario = pgTable('movimiento_inventario', {
  id: serial('id').primaryKey(),
  tiendaId: integer('tienda_id').notNull().references(() => tienda.id),
  productoId: integer('producto_id').notNull().references(() => producto.id),
  tipo: tipoMovimiento('tipo').notNull(),
  // Con signo: positiva suma al stock, negativa resta
  cantidad: cantidad('cantidad').notNull(),
  referenciaTipo: text('referencia_tipo'),
  referenciaId: integer('referencia_id'),
  userId: text('user_id').notNull().references(() => user.id),
  nota: text('nota'),
  createdAt: timestamptz('created_at').notNull().defaultNow()
}, t => [
  index('movimiento_tienda_producto_fecha_idx').on(t.tiendaId, t.productoId, t.createdAt)
])

export const entradaInventario = pgTable('entrada_inventario', {
  id: serial('id').primaryKey(),
  tiendaId: integer('tienda_id').notNull().references(() => tienda.id),
  userId: text('user_id').notNull().references(() => user.id),
  nota: text('nota'),
  createdAt: timestamptz('created_at').notNull().defaultNow()
}, t => [
  index('entrada_tienda_fecha_idx').on(t.tiendaId, t.createdAt)
])

export const entradaInventarioDetalle = pgTable('entrada_inventario_detalle', {
  entradaId: integer('entrada_id').notNull().references(() => entradaInventario.id, { onDelete: 'cascade' }),
  productoId: integer('producto_id').notNull().references(() => producto.id),
  cantidad: cantidad('cantidad').notNull()
}, t => [
  primaryKey({ columns: [t.entradaId, t.productoId] }),
  check('entrada_detalle_cantidad_positiva', sql`${t.cantidad} > 0`)
])

// ==========================================
// CAJA
// ==========================================

export const turnoCaja = pgTable('turno_caja', {
  id: serial('id').primaryKey(),
  tiendaId: integer('tienda_id').notNull().references(() => tienda.id),
  userId: text('user_id').notNull().references(() => user.id),
  abiertoAt: timestamptz('abierto_at').notNull().defaultNow(),
  montoInicialCentavos: integer('monto_inicial_centavos').notNull(),
  cerradoAt: timestamptz('cerrado_at'),
  // Se calculan y guardan al cerrar
  efectivoEsperadoCentavos: integer('efectivo_esperado_centavos'),
  efectivoContadoCentavos: integer('efectivo_contado_centavos'),
  diferenciaCentavos: integer('diferencia_centavos'),
  nota: text('nota')
}, t => [
  // Un solo turno abierto por usuario y tienda
  uniqueIndex('turno_caja_abierto_unico').on(t.tiendaId, t.userId).where(sql`${t.cerradoAt} is null`),
  index('turno_caja_tienda_abierto_idx').on(t.tiendaId, t.abiertoAt),
  check('turno_caja_monto_inicial_no_negativo', sql`${t.montoInicialCentavos} >= 0`),
  check('turno_caja_contado_no_negativo', sql`${t.efectivoContadoCentavos} >= 0`)
])

// Efectivo que sale de un turno (lo registra el admin)
export const salidaCaja = pgTable('salida_caja', {
  id: serial('id').primaryKey(),
  turnoId: integer('turno_id').notNull().references(() => turnoCaja.id),
  tiendaId: integer('tienda_id').notNull().references(() => tienda.id),
  userId: text('user_id').notNull().references(() => user.id),
  montoCentavos: integer('monto_centavos').notNull(),
  motivo: text('motivo').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow()
}, t => [
  index('salida_caja_turno_id_idx').on(t.turnoId),
  check('salida_caja_monto_positivo', sql`${t.montoCentavos} > 0`)
])

// ==========================================
// VENTAS
// ==========================================

export const metodoPago = pgEnum('metodo_pago', METODOS_PAGO)
export const estadoVenta = pgEnum('estado_venta', ['completada', 'anulada'])

export const venta = pgTable('venta', {
  id: serial('id').primaryKey(),
  tiendaId: integer('tienda_id').notNull().references(() => tienda.id),
  turnoId: integer('turno_id').notNull().references(() => turnoCaja.id),
  correlativo: integer('correlativo').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
  totalCentavos: integer('total_centavos').notNull(),
  metodoPago: metodoPago('metodo_pago').notNull(),
  montoRecibidoCentavos: integer('monto_recibido_centavos').notNull(),
  cambioCentavos: integer('cambio_centavos').notNull().default(0),
  estado: estadoVenta('estado').notNull().default('completada'),
  conStockInsuficiente: boolean('con_stock_insuficiente').notNull().default(false),
  anuladaPor: text('anulada_por').references(() => user.id),
  anuladaAt: timestamptz('anulada_at'),
  motivoAnulacion: text('motivo_anulacion'),
  createdAt: timestamptz('created_at').notNull().defaultNow()
}, t => [
  uniqueIndex('venta_tienda_correlativo_unico').on(t.tiendaId, t.correlativo),
  index('venta_tienda_fecha_idx').on(t.tiendaId, t.createdAt),
  index('venta_turno_id_idx').on(t.turnoId),
  check('venta_total_no_negativo', sql`${t.totalCentavos} >= 0`),
  check('venta_cambio_no_negativo', sql`${t.cambioCentavos} >= 0`)
])

// Guarda nombre, unidad y precio del momento de la venta
export const ventaDetalle = pgTable('venta_detalle', {
  ventaId: integer('venta_id').notNull().references(() => venta.id),
  productoId: integer('producto_id').notNull().references(() => producto.id),
  nombreProducto: text('nombre_producto').notNull(),
  unidadMedida: unidadMedida('unidad_medida').notNull(),
  precioUnitarioCentavos: integer('precio_unitario_centavos').notNull(),
  cantidad: cantidad('cantidad').notNull(),
  subtotalCentavos: integer('subtotal_centavos').notNull()
}, t => [
  primaryKey({ columns: [t.ventaId, t.productoId] }),
  check('venta_detalle_cantidad_positiva', sql`${t.cantidad} > 0`)
])

// ==========================================
// RELACIONES
// ==========================================

export const tiendaRelations = relations(tienda, ({ many }) => ({
  usuarios: many(usuarioTienda)
}))

export const userRelations = relations(user, ({ one, many }) => ({
  tiendaActiva: one(tienda, { fields: [user.tiendaActivaId], references: [tienda.id] }),
  tiendas: many(usuarioTienda),
  sessions: many(session),
  accounts: many(account)
}))

export const usuarioTiendaRelations = relations(usuarioTienda, ({ one }) => ({
  user: one(user, { fields: [usuarioTienda.userId], references: [user.id] }),
  tienda: one(tienda, { fields: [usuarioTienda.tiendaId], references: [tienda.id] })
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] })
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] })
}))

export const categoriaRelations = relations(categoria, ({ many }) => ({
  productos: many(producto)
}))

export const productoRelations = relations(producto, ({ one, many }) => ({
  categoria: one(categoria, { fields: [producto.categoriaId], references: [categoria.id] }),
  stock: many(stockTienda)
}))

export const stockTiendaRelations = relations(stockTienda, ({ one }) => ({
  tienda: one(tienda, { fields: [stockTienda.tiendaId], references: [tienda.id] }),
  producto: one(producto, { fields: [stockTienda.productoId], references: [producto.id] })
}))

export const entradaInventarioRelations = relations(entradaInventario, ({ one, many }) => ({
  tienda: one(tienda, { fields: [entradaInventario.tiendaId], references: [tienda.id] }),
  user: one(user, { fields: [entradaInventario.userId], references: [user.id] }),
  detalle: many(entradaInventarioDetalle)
}))

export const entradaInventarioDetalleRelations = relations(entradaInventarioDetalle, ({ one }) => ({
  entrada: one(entradaInventario, { fields: [entradaInventarioDetalle.entradaId], references: [entradaInventario.id] }),
  producto: one(producto, { fields: [entradaInventarioDetalle.productoId], references: [producto.id] })
}))
