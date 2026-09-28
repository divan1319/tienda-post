CREATE TYPE "public"."estado_venta" AS ENUM('completada', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."metodo_pago" AS ENUM('efectivo', 'tarjeta', 'transferencia');--> statement-breakpoint
CREATE TABLE "salida_caja" (
	"id" serial PRIMARY KEY NOT NULL,
	"turno_id" integer NOT NULL,
	"tienda_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"monto_centavos" integer NOT NULL,
	"motivo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salida_caja_monto_positivo" CHECK ("salida_caja"."monto_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "turno_caja" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"abierto_at" timestamp with time zone DEFAULT now() NOT NULL,
	"monto_inicial_centavos" integer NOT NULL,
	"cerrado_at" timestamp with time zone,
	"efectivo_esperado_centavos" integer,
	"efectivo_contado_centavos" integer,
	"diferencia_centavos" integer,
	"nota" text,
	CONSTRAINT "turno_caja_monto_inicial_no_negativo" CHECK ("turno_caja"."monto_inicial_centavos" >= 0),
	CONSTRAINT "turno_caja_contado_no_negativo" CHECK ("turno_caja"."efectivo_contado_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "venta" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"turno_id" integer NOT NULL,
	"correlativo" integer NOT NULL,
	"user_id" text NOT NULL,
	"total_centavos" integer NOT NULL,
	"metodo_pago" "metodo_pago" NOT NULL,
	"monto_recibido_centavos" integer NOT NULL,
	"cambio_centavos" integer DEFAULT 0 NOT NULL,
	"estado" "estado_venta" DEFAULT 'completada' NOT NULL,
	"con_stock_insuficiente" boolean DEFAULT false NOT NULL,
	"anulada_por" text,
	"anulada_at" timestamp with time zone,
	"motivo_anulacion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venta_total_no_negativo" CHECK ("venta"."total_centavos" >= 0),
	CONSTRAINT "venta_cambio_no_negativo" CHECK ("venta"."cambio_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "venta_detalle" (
	"venta_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"nombre_producto" text NOT NULL,
	"unidad_medida" "unidad_medida" NOT NULL,
	"precio_unitario_centavos" integer NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"subtotal_centavos" integer NOT NULL,
	CONSTRAINT "venta_detalle_venta_id_producto_id_pk" PRIMARY KEY("venta_id","producto_id"),
	CONSTRAINT "venta_detalle_cantidad_positiva" CHECK ("venta_detalle"."cantidad" > 0)
);
--> statement-breakpoint
ALTER TABLE "salida_caja" ADD CONSTRAINT "salida_caja_turno_id_turno_caja_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turno_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salida_caja" ADD CONSTRAINT "salida_caja_tienda_id_tienda_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tienda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salida_caja" ADD CONSTRAINT "salida_caja_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_caja" ADD CONSTRAINT "turno_caja_tienda_id_tienda_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tienda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_caja" ADD CONSTRAINT "turno_caja_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_tienda_id_tienda_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tienda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_turno_id_turno_caja_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turno_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_anulada_por_user_id_fk" FOREIGN KEY ("anulada_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "salida_caja_turno_id_idx" ON "salida_caja" USING btree ("turno_id");--> statement-breakpoint
CREATE UNIQUE INDEX "turno_caja_abierto_unico" ON "turno_caja" USING btree ("tienda_id","user_id") WHERE "turno_caja"."cerrado_at" is null;--> statement-breakpoint
CREATE INDEX "turno_caja_tienda_abierto_idx" ON "turno_caja" USING btree ("tienda_id","abierto_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venta_tienda_correlativo_unico" ON "venta" USING btree ("tienda_id","correlativo");--> statement-breakpoint
CREATE INDEX "venta_tienda_fecha_idx" ON "venta" USING btree ("tienda_id","created_at");--> statement-breakpoint
CREATE INDEX "venta_turno_id_idx" ON "venta" USING btree ("turno_id");