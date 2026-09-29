# Tienda POS

Sistema POS para tiendas: un solo proyecto Nuxt 4 (interfaz + API en Nitro), con Neon Postgres, Drizzle, Better Auth y Nuxt UI. El plan completo está en [`docs/PLAN.md`](docs/PLAN.md).

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Copiar `.env.example` a `.env` y completar los valores:
   - `DATABASE_URL`: cadena de conexión de Neon.
   - `BETTER_AUTH_SECRET`: se genera localmente, por ejemplo con `openssl rand -base64 32`.
   - `BETTER_AUTH_URL`: URL de desarrollo o de producción.
   - `AWS_*` y `S3_BUCKET`: credenciales del storage S3-compatible de Neon.

3. Aplicar las migraciones:

   ```bash
   pnpm db:migrate
   ```

4. Crear el administrador inicial (no hay registro público):

   ```bash
   pnpm auth:create-admin <email> "<nombre>" "<contraseña>"
   ```

5. Crear las tiendas (también se pueden crear desde `/admin/tiendas`):

   ```bash
   pnpm db:seed "<nombre tienda 1>" "<nombre tienda 2>"
   ```

6. Levantar el servidor de desarrollo:

   ```bash
   pnpm dev
   ```

## Datos de demostración

Para probar la app con datos realistas:

```bash
pnpm db:fresh --seed
```

`db:fresh` **borra todas las tablas, tipos y el registro de migraciones** de la base de `DATABASE_URL` y vuelve a migrar. Pide escribir el nombre de la base para confirmar (`--yes` omite la confirmación, por ejemplo en scripts) y no corre con `NODE_ENV=production`. Sin `--seed` deja la base vacía y migrada; `pnpm db:seed:demo` carga la demo en una base vacía.

La demo (`server/db/seeders/`) crea:

- **Tiendas:** Tienda Centro y Tienda Norte.
- **Usuarios** (contraseña `Demo12345!`): `admin@demo.local` (admin), `ana@demo.local` (Centro), `maria@demo.local` (Norte) y `lucia@demo.local` (las dos tiendas; atiende los domingos).
- **Catálogo:** 8 categorías y 38 productos, algunos por libra o litro y otros con código de barras interno (prefijo 200, reservado para uso interno).
- **60 días de operación** hasta hoy, con las reglas de la app: turnos de caja con su corte (a veces con faltante o sobrante), ventas con correlativo por tienda y algunas anuladas, pan del día pagado con efectivo de la caja, pedidos semanales recibidos como compras con su entrada de inventario, conteos físicos, mermas y gastos menores.
- **Para el panel:** pedidos de hoy, atrasados y próximos; productos en «Stock bajo» y en «Stock por corregir».

Los datos son siempre los mismos (semilla fija), pero las fechas se calculan desde el día en que se corre. Al terminar, el seeder verifica que el stock cuadre con sus movimientos, que los cortes cuadren con sus ventas y salidas, y que los correlativos sean consecutivos.

## Variables de entorno en producción

`nuxt.config.ts` declara `runtimeConfig` con valores `{{VAR}}` que Nitro expande desde `process.env` al arrancar (`nitro.experimental.envExpansion`). Así los secretos no quedan dentro del build y las variables conservan sus nombres estándar (`DATABASE_URL`, `AWS_*`, …): basta con definirlas en el entorno del servidor.

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Verificación de tipos |
| `pnpm test` | Pruebas unitarias (Vitest) |
| `pnpm db:generate` | Genera una migración a partir de `server/db/schema.ts` |
| `pnpm db:migrate` | Aplica las migraciones pendientes |
| `pnpm db:fresh` | Borra todo y vuelve a migrar (`--seed` carga la demo, `--yes` sin confirmación) |
| `pnpm db:seed` | Crea tiendas por nombre (idempotente) |
| `pnpm db:seed:demo` | Carga los datos de demostración en una base vacía |
| `pnpm auth:create-admin` | Crea el admin inicial o promueve un usuario existente |
