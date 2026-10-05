ALTER TABLE "categoria" ADD COLUMN "codigo" text;--> statement-breakpoint
-- Código de las categorías existentes, igual que codigoDesdeNombre (shared/utils/codigo.ts):
-- sin acentos, en minúsculas y con «_» en lugar de lo que no sea letra o número.
-- Si dos nombres dan el mismo código, desde el segundo se agrega el id.
WITH base AS (
	SELECT
		"id",
		rtrim(left(trim(BOTH '_' FROM regexp_replace(
			lower(translate("nombre", 'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç', 'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc')),
			'[^a-z0-9]+', '_', 'g'
		)), 100), '_') AS "codigo"
	FROM "categoria"
), unicos AS (
	SELECT
		"id",
		CASE
			WHEN "codigo" = '' THEN 'categoria_' || "id"
			WHEN row_number() OVER (PARTITION BY "codigo" ORDER BY "id") > 1 THEN "codigo" || '_' || "id"
			ELSE "codigo"
		END AS "codigo"
	FROM base
)
UPDATE "categoria" c SET "codigo" = u."codigo" FROM unicos u WHERE u."id" = c."id";--> statement-breakpoint
ALTER TABLE "categoria" ALTER COLUMN "codigo" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_codigo_unique" UNIQUE("codigo");
