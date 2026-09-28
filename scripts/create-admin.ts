import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { createDb, user } from '../server/db'
import { createAuth } from '../server/lib/auth'

// Uso: pnpm auth:create-admin <email> <nombre> <contraseña>
async function main() {
  const [email, name, password] = process.argv.slice(2)

  if (!email || !name || !password) {
    console.error('Uso: pnpm auth:create-admin <email> <nombre> <contraseña>')
    process.exit(1)
  }

  const db = createDb(process.env.DATABASE_URL ?? '')
  const auth = createAuth(db, {
    secret: process.env.BETTER_AUTH_SECRET ?? '',
    baseURL: process.env.BETTER_AUTH_URL ?? ''
  })

  const [existente] = await db.select().from(user).where(eq(user.email, email.toLowerCase())).limit(1)

  if (existente) {
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, existente.id))
    console.log(`El usuario ${email} ya existía; ahora tiene rol admin.`)
    return
  }

  // Llamada del servidor sin headers: el plugin admin permite crear la cuenta sin sesión.
  await auth.api.createUser({
    body: { email, name, password, role: 'admin' }
  })

  console.log(`Administrador creado: ${email}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error creando administrador:', err?.message || err)
    process.exit(1)
  })
