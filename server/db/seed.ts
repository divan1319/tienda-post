import 'dotenv/config'
import { createDb, tienda } from './index'

// Uso: pnpm db:seed "<nombre tienda 1>" "<nombre tienda 2>" …
// Crea las tiendas indicadas si no existen (idempotente).
async function main() {
  const nombres = process.argv.slice(2).map(n => n.trim()).filter(Boolean)

  if (!nombres.length) {
    console.error('Uso: pnpm db:seed "<nombre tienda>" ["<nombre tienda>" …]')
    process.exit(1)
  }

  const db = createDb(process.env.DATABASE_URL ?? '')

  const creadas = await db
    .insert(tienda)
    .values(nombres.map(nombre => ({ nombre })))
    .onConflictDoNothing({ target: tienda.nombre })
    .returning({ id: tienda.id, nombre: tienda.nombre })

  console.log(`Tiendas creadas: ${creadas.length}`)
  for (const t of creadas) console.log(`  #${t.id} ${t.nombre}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
