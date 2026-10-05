import 'dotenv/config'
import { createDb } from '../server/db'
import { CATEGORIAS, sembrarCatalogos } from '../server/db/seeders/catalogos'

// Uso: pnpm db:seed:catalogos
// Crea solo los catálogos (categorías) que falten; no toca productos, tiendas ni usuarios.
async function main() {
  const db = createDb(process.env.DATABASE_URL ?? '')
  const { categorias } = await sembrarCatalogos(db)

  console.log(`Categorías creadas: ${categorias.length} (ya existían ${CATEGORIAS.length - categorias.length})`)
  for (const c of categorias) console.log(`  #${c.id} ${c.nombre} (${c.codigo})`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err?.message || err)
    process.exit(1)
  })
