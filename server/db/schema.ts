import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  index,
  primaryKey
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Todas las fechas se guardan como timestamptz (ver docs/PLAN.md, "Reglas generales").
const timestamptz = (name: string) => timestamp(name, { withTimezone: true })

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
