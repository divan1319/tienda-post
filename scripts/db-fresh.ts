import { fileURLToPath } from 'node:url'
import readline from 'node:readline/promises'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'
import { sembrarDemo } from '../server/db/seeders'
import { conexion, describirBase, imprimirResumen } from './entorno'

// Uso: pnpm db:fresh [--seed] [--yes]
//   Borra TODAS las tablas, tipos y el registro de migraciones, y vuelve a migrar.
//   --seed  carga además los datos de demostración
//   --yes   no pide confirmación (para scripts); sin él hay que escribir el nombre de la base
async function main() {
  const args = new Set(process.argv.slice(2))
  const conSemilla = args.has('--seed')

  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:fresh no se ejecuta con NODE_ENV=production.')
  }

  const base = describirBase()
  if (!base.nombre) throw new Error('DATABASE_URL no está configurada o no es válida.')

  if (!args.has('--yes')) {
    if (!process.stdin.isTTY) {
      throw new Error('Sin terminal interactiva: confirma con --yes.')
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const respuesta = await rl.question(
      `\n⚠  Se borrarán TODOS los datos de la base «${base.nombre}» en ${base.host}.\n`
      + `   Escribe el nombre de la base para confirmar: `
    )
    rl.close()
    if (respuesta.trim() !== base.nombre) {
      console.log('Cancelado: el nombre no coincide.')
      return
    }
  }

  const { db, auth } = conexion()

  console.log('Borrando tablas, tipos y migraciones…')
  await db.execute(sql.raw(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      FOR r IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
               WHERE n.nspname = 'public' AND t.typtype = 'e' LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `))
  // drizzle-kit guarda el registro de migraciones en el esquema «drizzle»
  await db.execute(sql.raw('DROP SCHEMA IF EXISTS drizzle CASCADE'))

  console.log('Aplicando migraciones…')
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })

  if (conSemilla) {
    imprimirResumen(await sembrarDemo(db, auth))
  } else {
    console.log('Base vacía y migrada. Crea el admin con `pnpm auth:create-admin` o carga la demo con `pnpm db:seed:demo`.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err?.message || err)
    process.exit(1)
  })
