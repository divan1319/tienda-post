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
| `pnpm db:seed` | Crea tiendas por nombre (idempotente) |
| `pnpm auth:create-admin` | Crea el admin inicial o promueve un usuario existente |
