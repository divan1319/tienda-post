CREATE TYPE "public"."estado_pedido" AS ENUM('pendiente', 'recibido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."tipo_compra" AS ENUM('pedido', 'directa');--> statement-breakpoint
CREATE TABLE "compra" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"tipo" "tipo_compra" NOT NULL,
	"pedido_id" integer,
	"nombre" text NOT NULL,
	"proveedor" text,
	"total_centavos" integer NOT NULL,
	"numero_factura" text,
	"comprobante_key" text,
	"fecha_compra" date NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compra_pedido_id_unique" UNIQUE("pedido_id"),
	CONSTRAINT "compra_tipo_pedido" CHECK (("compra"."tipo" = 'pedido' AND "compra"."pedido_id" IS NOT NULL) OR ("compra"."tipo" = 'directa' AND "compra"."pedido_id" IS NULL)),
	CONSTRAINT "compra_total_positivo" CHECK ("compra"."total_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "pedido" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"proveedor" text,
	"fecha_esperada" date NOT NULL,
	"estado" "estado_pedido" DEFAULT 'pendiente' NOT NULL,
	"nota" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salida_caja" ADD COLUMN "compra_id" integer;--> statement-breakpoint
ALTER TABLE "compra" ADD CONSTRAINT "compra_tienda_id_tienda_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tienda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra" ADD CONSTRAINT "compra_pedido_id_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra" ADD CONSTRAINT "compra_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_tienda_id_tienda_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tienda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compra_tienda_fecha_idx" ON "compra" USING btree ("tienda_id","fecha_compra");--> statement-breakpoint
CREATE INDEX "pedido_estado_fecha_idx" ON "pedido" USING btree ("estado","fecha_esperada");--> statement-breakpoint
CREATE INDEX "pedido_tienda_idx" ON "pedido" USING btree ("tienda_id");--> statement-breakpoint
ALTER TABLE "salida_caja" ADD CONSTRAINT "salida_caja_compra_id_compra_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salida_caja" ADD CONSTRAINT "salida_caja_compra_id_unique" UNIQUE("compra_id");