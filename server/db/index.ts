import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'

// `Pool` + drizzle-orm/neon-serverless: este driver permite transacciones.
export function createDb(connectionString: string) {
  if (!connectionString) {
    throw new Error('[db] DATABASE_URL no está configurada. Agrega la cadena de conexión de Neon en el archivo .env')
  }
  const pool = new Pool({ connectionString })
  return drizzle(pool, { schema })
}

export type Db = ReturnType<typeof createDb>

export * from './schema'
