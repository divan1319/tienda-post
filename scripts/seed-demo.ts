import { sembrarDemo } from '../server/db/seeders'
import { conexion, imprimirResumen } from './entorno'

// Uso: pnpm db:seed:demo  (la base debe estar vacía y migrada: pnpm db:fresh)
async function main() {
  const { db, auth } = conexion()
  imprimirResumen(await sembrarDemo(db, auth))
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err?.message || err)
    process.exit(1)
  })
