import 'dotenv/config'
import { createDb } from '../server/db'
import { createAuth } from '../server/lib/auth'

/** Base y Better Auth a partir del .env, para los scripts de tsx. */
export function conexion() {
  const db = createDb(process.env.DATABASE_URL ?? '')
  const auth = createAuth(db, {
    secret: process.env.BETTER_AUTH_SECRET ?? '',
    baseURL: process.env.BETTER_AUTH_URL ?? ''
  })
  return { db, auth }
}

/** Host y nombre de la base de DATABASE_URL (sin credenciales), para mostrar y confirmar. */
export function describirBase() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '')
    return { host: url.hostname, nombre: decodeURIComponent(url.pathname.replace(/^\//, '')) }
  } catch {
    return { host: '?', nombre: '' }
  }
}

export function imprimirResumen(r: Awaited<ReturnType<typeof import('../server/db/seeders').sembrarDemo>>) {
  console.log('\nDatos de demostración cargados:')
  console.log(`  Ventas: ${r.ventas} (${r.anuladas} anuladas) · Turnos: ${r.turnos} (${r.abiertos} abiertos hoy)`)
  console.log(`  Compras: ${r.compras} · Pedidos: ${r.pedidos} (${r.pendientes} pendientes) · Movimientos de inventario: ${r.movimientos}`)
  console.log('\nUsuarios (contraseña de demostración):')
  console.table(r.usuarios)
}
