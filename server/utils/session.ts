import type { H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import { tienda, user, usuarioTienda } from '../db/schema'

export async function requireUserSession(event: H3Event) {
  const session = await useAuth().api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'No autenticado. Por favor inicie sesión.'
    })
  }
  return session
}

export function isAdmin(u: { role?: string | null }) {
  return u.role === 'admin'
}

export async function requireAdmin(event: H3Event) {
  const session = await requireUserSession(event)
  if (!isAdmin(session.user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Acceso denegado. Se requiere rol de administrador.'
    })
  }
  return session
}

/**
 * Tiendas a las que el usuario tiene acceso: el admin ve todas las activas;
 * la vendedora, solo las activas que tiene asignadas.
 */
export async function tiendasDelUsuario(u: { id: string, role?: string | null }) {
  const db = useDb()
  const columnas = { id: tienda.id, nombre: tienda.nombre, direccion: tienda.direccion }

  if (isAdmin(u)) {
    return db.select(columnas).from(tienda).where(eq(tienda.activa, true)).orderBy(tienda.nombre)
  }

  return db
    .select(columnas)
    .from(usuarioTienda)
    .innerJoin(tienda, eq(tienda.id, usuarioTienda.tiendaId))
    .where(and(eq(usuarioTienda.userId, u.id), eq(tienda.activa, true)))
    .orderBy(tienda.nombre)
}

/** Confirma que el usuario puede operar en la tienda indicada. */
export async function puedeUsarTienda(u: { id: string, role?: string | null }, tiendaId: number) {
  const db = useDb()

  if (isAdmin(u)) {
    const [t] = await db
      .select({ id: tienda.id })
      .from(tienda)
      .where(and(eq(tienda.id, tiendaId), eq(tienda.activa, true)))
      .limit(1)
    return !!t
  }

  const [asignada] = await db
    .select({ id: tienda.id })
    .from(usuarioTienda)
    .innerJoin(tienda, eq(tienda.id, usuarioTienda.tiendaId))
    .where(and(
      eq(usuarioTienda.userId, u.id),
      eq(usuarioTienda.tiendaId, tiendaId),
      eq(tienda.activa, true)
    ))
    .limit(1)
  return !!asignada
}

/**
 * Devuelve la tienda activa del usuario y confirma que sigue asignada.
 * Las rutas de venta, stock y caja la usan en lugar de aceptar un `tiendaId`
 * del cliente; solo el admin puede enviar `tiendaId` explícito.
 */
export async function requireTienda(event: H3Event, opts: { tiendaId?: number | null } = {}) {
  const session = await requireUserSession(event)

  let tiendaId: number | null

  if (isAdmin(session.user) && opts.tiendaId) {
    tiendaId = opts.tiendaId
  } else {
    // Se lee de la base para no depender de una sesión en caché.
    const [row] = await useDb()
      .select({ tiendaActivaId: user.tiendaActivaId })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)
    tiendaId = row?.tiendaActivaId ?? null
  }

  if (!tiendaId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Selecciona una tienda activa para continuar.',
      data: { code: 'TIENDA_NO_SELECCIONADA' }
    })
  }

  if (!(await puedeUsarTienda(session.user, tiendaId))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes acceso a esta tienda.',
      data: { code: 'TIENDA_NO_ASIGNADA' }
    })
  }

  return { session, tiendaId }
}
