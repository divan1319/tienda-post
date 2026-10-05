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

   Opcional: cargar los catálogos base (categorías), sin productos ni datos de demostración:

   ```bash
   pnpm db:seed:catalogos
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

## Importación masiva de productos

En `/productos/importar` (solo admin):

1. Se descarga la plantilla `.xlsx` (`GET /api/productos/plantilla`). Trae las columnas del formulario de producto: nombre, código de barras, categoría, unidad de medida y precio, con listas desplegables para la unidad y las categorías activas. Los productos se crean activos y sin foto.
2. Al subir el archivo se ve la vista previa de la hoja ([SpreadsheetPreview](https://spreadsheetpreview.com/docs#vue), en el navegador) y el servidor valida cada fila sin guardar nada (`POST /api/productos/importacion/analizar`).
3. «Importar» guarda en una transacción solo las filas sin errores (`POST /api/productos/importacion`); las demás se listan con su motivo. Una categoría que no existe se crea con su código; la búsqueda de categorías es por código, así que «LÁCTEOS» y «lacteos» son la misma.

Límites: `.xlsx` de hasta 2 MB y 2000 productos por archivo.

**Licencia de SpreadsheetPreview:** es software propietario de DataGridXL. La edición comunitaria (la que se usa, con el sello «Powered by SpreadsheetPreview» visible) solo cubre evaluación, demos y uso no comercial; el uso en un negocio o en producción requiere una licencia comercial (ver `node_modules/@datagridxl/spreadsheet-preview/LICENSE.md`). La imagen del sello se carga desde `cdn.spreadsheetpreview.com`.

## Códigos de categoría

Cada categoría tiene un `codigo` único en snake_case sin acentos, generado a partir del nombre al crearla (`Nombre categoría nuevo` → `nombre_categoria_nuevo`). El servidor lo calcula (no lo acepta del cliente) y no cambia al editar el nombre. La migración `0004_categoria_codigo` genera el código de las categorías existentes.

## PWA

La app se puede instalar desde el navegador (`@vite-pwa/nuxt`). El service worker guarda en caché solo los recursos estáticos: las páginas y la API siempre van al servidor, porque la app depende de la sesión y de datos en vivo (el trabajo sin conexión está fuera de la versión 1). Cuando hay una versión nueva aparece el aviso «Actualizar» en lugar de recargar sola, para no perder el carrito del POS. El service worker solo se genera en el build (`pnpm build` + `pnpm preview`), no en `pnpm dev`.

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
| `pnpm db:seed:catalogos` | Crea los catálogos base (categorías) que falten (idempotente) |
| `pnpm auth:create-admin` | Crea el admin inicial o promueve un usuario existente |
