import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import type { Db } from '../db'
import * as schema from '../db/schema'
import { ac, roles } from '../../shared/roles'

interface AuthConfig {
  secret: string
  baseURL: string
}

// Fábrica compartida entre Nitro (server/utils/auth.ts) y los scripts de tsx.
export function createAuth(db: Db, { secret, baseURL }: AuthConfig) {
  if (!secret) {
    throw new Error('[auth] BETTER_AUTH_SECRET no está configurada en el archivo .env')
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema
    }),
    emailAndPassword: {
      enabled: true,
      // Sin registro público: solo existe /login y el admin crea las cuentas
      disableSignUp: true
    },
    user: {
      additionalFields: {
        tiendaActivaId: {
          type: 'number',
          required: false,
          input: false
        }
      }
    },
    plugins: [
      admin({
        ac,
        roles,
        defaultRole: 'vendedora',
        adminRoles: ['admin']
      })
    ],
    secret,
    baseURL: baseURL || undefined
  })
}

export type Auth = ReturnType<typeof createAuth>
