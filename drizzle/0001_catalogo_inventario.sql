CREATE TYPE "public"."tipo_movimiento" AS ENUM('entrada', 'venta', 'anulacion_venta', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."unidad_medida" AS ENUM('unidad', 'libra', 'litro');--> statement-breakpoint
CREATE TABLE "categoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categoria_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "entrada_inventario" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entrada_inventario_detalle" (
	"entrada_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	CONSTRAINT "entrada_inventario_detalle_entrada_id_producto_id_pk" PRIMARY KEY("entrada_id","producto_id"),
	CONSTRAINT "entrada_detalle_cantidad_positiva" CHECK ("entrada_inventario_detalle"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "movimiento_inventario" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"referencia_tipo" text,
	"referencia_id" integer,
	"user_id" text NOT NULL,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producto" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"codigo_barras" text,
	"categoria_id" integer,
	"unidad_medida" "unidad_medida" DEFAULT 'unidad' NOT NULL,
	"precio_venta_centavos" integer NOT NULL,
	"foto_key" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "producto_codigo_barras_unique" UNIQUE("codigo_barras"),
	CONSTRAINT "producto_precio_no_negativo" CHECK ("producto"."precio_venta_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_tienda" (
	"tienda_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" numeric(12, 3) DEFAULT 0 NOT NULL,
	"stock_minimo" numeric(12, 3),
	CONSTRAINT "stock_tienda_tienda_id_producto_id_pk" PRIMARY KEY("tienda_id","producto_id")
);
--> statement-breakpoint
ALTER TABLE "entrada_inventario" ADD CONSTRAINT "entrada_inventario_tienda_id_tienda_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tienda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada_inventario" ADD CONSTRAINT "entrada_inventario_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada_inventario_detalle" ADD CONSTRAINT "entrada_inventario_detalle_entrada_id_entrada_inventario_id_fk" FOREIGN KEY ("entrada_id") REFERENCES "public"."entrada_inventario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada_inventario_detalle" ADD CONSTRAINT "entrada_inventario_detalle_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_tienda_id_tienda_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tienda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_tienda" ADD CONSTRAINT "stock_tienda_tienda_id_tienda_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tienda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_tienda" ADD CONSTRAINT "stock_tienda_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entrada_tienda_fecha_idx" ON "entrada_inventario" USING btree ("tienda_id","created_at");--> statement-breakpoint
CREATE INDEX "movimiento_tienda_producto_fecha_idx" ON "movimiento_inventario" USING btree ("tienda_id","producto_id","created_at");--> statement-breakpoint
CREATE INDEX "producto_categoria_id_idx" ON "producto" USING btree ("categoria_id");