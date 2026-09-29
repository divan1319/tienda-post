import type { UnidadMedida } from '../../../shared/utils/cantidad'

// Datos de demostración (ficticios). Precios en centavos.

export const CONTRASENA_DEMO = 'Demo12345!'

export const TIENDAS = [
  { clave: 'centro', nombre: 'Tienda Centro', direccion: 'Av. Principal #12, Barrio El Centro', ventasPorDia: 24, escalaStock: 1 },
  { clave: 'norte', nombre: 'Tienda Norte', direccion: 'Calle al Mercado #45, Colonia Las Flores', ventasPorDia: 15, escalaStock: 0.6 }
] as const

export type ClaveTienda = typeof TIENDAS[number]['clave']

export const USUARIOS = [
  { clave: 'admin', nombre: 'Administrador Demo', email: 'admin@demo.local', rol: 'admin', tiendas: [] as ClaveTienda[] },
  { clave: 'ana', nombre: 'Ana Martínez', email: 'ana@demo.local', rol: 'vendedora', tiendas: ['centro'] as ClaveTienda[] },
  { clave: 'maria', nombre: 'María Hernández', email: 'maria@demo.local', rol: 'vendedora', tiendas: ['norte'] as ClaveTienda[] },
  // Cubre los domingos en las dos tiendas
  { clave: 'lucia', nombre: 'Lucía Ramos', email: 'lucia@demo.local', rol: 'vendedora', tiendas: ['centro', 'norte'] as ClaveTienda[] }
] as const

export type ClaveUsuario = typeof USUARIOS[number]['clave']

/** Quién atiende cada tienda según el día de la semana (0 = domingo). */
export function vendedoraDelDia(tienda: ClaveTienda, dia: number): ClaveUsuario {
  if (dia === 0) return 'lucia'
  return tienda === 'centro' ? 'ana' : 'maria'
}

export const CATEGORIAS = [
  'Abarrotes',
  'Granos básicos',
  'Bebidas',
  'Lácteos y huevos',
  'Panadería',
  'Limpieza',
  'Higiene personal',
  'Snacks y golosinas'
] as const

export type Categoria = typeof CATEGORIAS[number]

export type Grupo = 'secos' | 'frescos' | 'pan'

export interface ProductoDemo {
  nombre: string
  categoria: Categoria | null
  unidad: UnidadMedida
  precio: number
  /** Peso relativo en las ventas */
  demanda: number
  /** Punto de reorden (stock mínimo) y stock objetivo al reabastecer, para la tienda Centro */
  minimo: number
  objetivo: number
  /** Pedido semanal al que pertenece */
  grupo: Grupo
  conCodigo?: boolean
  perecedero?: boolean
}

export const PRODUCTOS: ProductoDemo[] = [
  // Granos básicos por libra
  { nombre: 'Arroz blanco', categoria: 'Granos básicos', unidad: 'libra', precio: 55, demanda: 9, minimo: 40, objetivo: 150, grupo: 'secos' },
  { nombre: 'Frijol rojo de seda', categoria: 'Granos básicos', unidad: 'libra', precio: 95, demanda: 9, minimo: 40, objetivo: 150, grupo: 'secos' },
  { nombre: 'Azúcar blanca', categoria: 'Granos básicos', unidad: 'libra', precio: 50, demanda: 7, minimo: 30, objetivo: 120, grupo: 'secos' },
  { nombre: 'Maicillo', categoria: 'Granos básicos', unidad: 'libra', precio: 40, demanda: 2, minimo: 15, objetivo: 50, grupo: 'secos' },
  // Abarrotes
  { nombre: 'Aceite vegetal a granel', categoria: 'Abarrotes', unidad: 'litro', precio: 240, demanda: 5, minimo: 10, objetivo: 40, grupo: 'secos' },
  { nombre: 'Harina de maíz 1 lb', categoria: 'Abarrotes', unidad: 'unidad', precio: 75, demanda: 6, minimo: 20, objetivo: 60, grupo: 'secos', conCodigo: true },
  { nombre: 'Sal refinada 1 lb', categoria: 'Abarrotes', unidad: 'unidad', precio: 35, demanda: 2, minimo: 10, objetivo: 30, grupo: 'secos', conCodigo: true },
  { nombre: 'Café molido 200 g', categoria: 'Abarrotes', unidad: 'unidad', precio: 285, demanda: 3, minimo: 8, objetivo: 24, grupo: 'secos', conCodigo: true },
  { nombre: 'Espagueti 200 g', categoria: 'Abarrotes', unidad: 'unidad', precio: 60, demanda: 4, minimo: 12, objetivo: 40, grupo: 'secos', conCodigo: true },
  { nombre: 'Sopa instantánea', categoria: 'Abarrotes', unidad: 'unidad', precio: 45, demanda: 5, minimo: 20, objetivo: 60, grupo: 'secos', conCodigo: true },
  { nombre: 'Consomé de pollo (cubito)', categoria: 'Abarrotes', unidad: 'unidad', precio: 15, demanda: 4, minimo: 30, objetivo: 100, grupo: 'secos' },
  { nombre: 'Salsa de tomate 106 g', categoria: 'Abarrotes', unidad: 'unidad', precio: 50, demanda: 3, minimo: 12, objetivo: 36, grupo: 'secos', conCodigo: true },
  { nombre: 'Frijoles molidos en bolsa', categoria: 'Abarrotes', unidad: 'unidad', precio: 110, demanda: 3, minimo: 10, objetivo: 30, grupo: 'secos', conCodigo: true },
  // Bebidas
  { nombre: 'Agua embotellada 600 ml', categoria: 'Bebidas', unidad: 'unidad', precio: 60, demanda: 8, minimo: 24, objetivo: 96, grupo: 'frescos', conCodigo: true },
  { nombre: 'Gaseosa 2.5 L', categoria: 'Bebidas', unidad: 'unidad', precio: 225, demanda: 5, minimo: 12, objetivo: 36, grupo: 'frescos', conCodigo: true },
  { nombre: 'Gaseosa en lata 355 ml', categoria: 'Bebidas', unidad: 'unidad', precio: 75, demanda: 6, minimo: 24, objetivo: 72, grupo: 'frescos', conCodigo: true },
  { nombre: 'Jugo de naranja 1 L', categoria: 'Bebidas', unidad: 'unidad', precio: 180, demanda: 2, minimo: 6, objetivo: 18, grupo: 'frescos', conCodigo: true },
  { nombre: 'Bebida energizante', categoria: 'Bebidas', unidad: 'unidad', precio: 150, demanda: 2, minimo: 6, objetivo: 24, grupo: 'frescos', conCodigo: true },
  // Lácteos y huevos
  { nombre: 'Leche entera 1 L', categoria: 'Lácteos y huevos', unidad: 'unidad', precio: 125, demanda: 6, minimo: 12, objetivo: 36, grupo: 'frescos', conCodigo: true, perecedero: true },
  { nombre: 'Queso duro blando', categoria: 'Lácteos y huevos', unidad: 'libra', precio: 350, demanda: 4, minimo: 5, objetivo: 20, grupo: 'frescos', perecedero: true },
  { nombre: 'Crema 250 ml', categoria: 'Lácteos y huevos', unidad: 'unidad', precio: 150, demanda: 3, minimo: 8, objetivo: 24, grupo: 'frescos', conCodigo: true, perecedero: true },
  { nombre: 'Huevo', categoria: 'Lácteos y huevos', unidad: 'unidad', precio: 15, demanda: 7, minimo: 60, objetivo: 240, grupo: 'frescos' },
  // Panadería (llega a diario y se paga con efectivo de la caja)
  { nombre: 'Pan francés', categoria: 'Panadería', unidad: 'unidad', precio: 10, demanda: 8, minimo: 20, objetivo: 60, grupo: 'pan', perecedero: true },
  { nombre: 'Pan dulce', categoria: 'Panadería', unidad: 'unidad', precio: 35, demanda: 4, minimo: 10, objetivo: 30, grupo: 'pan', perecedero: true },
  { nombre: 'Pan de caja', categoria: 'Panadería', unidad: 'unidad', precio: 225, demanda: 2, minimo: 4, objetivo: 10, grupo: 'secos', conCodigo: true },
  // Limpieza
  { nombre: 'Jabón de lavar en barra', categoria: 'Limpieza', unidad: 'unidad', precio: 60, demanda: 4, minimo: 12, objetivo: 36, grupo: 'secos', conCodigo: true },
  { nombre: 'Detergente en polvo 500 g', categoria: 'Limpieza', unidad: 'unidad', precio: 150, demanda: 3, minimo: 8, objetivo: 24, grupo: 'secos', conCodigo: true },
  { nombre: 'Lejía 1 L', categoria: 'Limpieza', unidad: 'unidad', precio: 110, demanda: 2, minimo: 6, objetivo: 18, grupo: 'secos', conCodigo: true },
  { nombre: 'Papel higiénico 4 rollos', categoria: 'Limpieza', unidad: 'unidad', precio: 199, demanda: 3, minimo: 8, objetivo: 24, grupo: 'secos', conCodigo: true },
  // Higiene personal
  { nombre: 'Pasta dental 75 ml', categoria: 'Higiene personal', unidad: 'unidad', precio: 175, demanda: 2, minimo: 6, objetivo: 18, grupo: 'secos', conCodigo: true },
  { nombre: 'Shampoo en sobre', categoria: 'Higiene personal', unidad: 'unidad', precio: 25, demanda: 3, minimo: 20, objetivo: 60, grupo: 'secos' },
  { nombre: 'Jabón de baño', categoria: 'Higiene personal', unidad: 'unidad', precio: 85, demanda: 2, minimo: 8, objetivo: 24, grupo: 'secos', conCodigo: true },
  { nombre: 'Toallas sanitarias', categoria: 'Higiene personal', unidad: 'unidad', precio: 195, demanda: 1, minimo: 4, objetivo: 12, grupo: 'secos', conCodigo: true },
  // Snacks y golosinas
  { nombre: 'Churritos de maíz', categoria: 'Snacks y golosinas', unidad: 'unidad', precio: 25, demanda: 6, minimo: 20, objetivo: 60, grupo: 'secos' },
  { nombre: 'Galletas de vainilla', categoria: 'Snacks y golosinas', unidad: 'unidad', precio: 40, demanda: 4, minimo: 12, objetivo: 48, grupo: 'secos', conCodigo: true },
  { nombre: 'Chocolate en barra', categoria: 'Snacks y golosinas', unidad: 'unidad', precio: 60, demanda: 3, minimo: 12, objetivo: 36, grupo: 'secos', conCodigo: true },
  { nombre: 'Maní salado', categoria: 'Snacks y golosinas', unidad: 'unidad', precio: 50, demanda: 2, minimo: 10, objetivo: 30, grupo: 'secos' },
  // Sin categoría (para ver «Sin categoría» en la app)
  { nombre: 'Bolsa de hielo', categoria: null, unidad: 'unidad', precio: 100, demanda: 2, minimo: 5, objetivo: 15, grupo: 'frescos' }
]

export const PROVEEDORES: Record<Exclude<Grupo, 'pan'>, { proveedor: string, pedido: string, dia: number }> = {
  // Lunes: abarrotes, granos y limpieza
  secos: { proveedor: 'Distribuidora Central', pedido: 'Abarrotes y limpieza', dia: 1 },
  // Jueves: bebidas y lácteos
  frescos: { proveedor: 'Distribuidora Occidente', pedido: 'Bebidas y lácteos', dia: 4 }
}

export const PANADERIA = 'Panadería San Miguel'

/** Código EAN-13 del rango 200–299, reservado para uso interno (no choca con productos reales). */
export function codigoInterno(n: number): string {
  const base = `2000${String(n).padStart(8, '0')}`
  const suma = base.split('').reduce((s, c, i) => s + Number(c) * (i % 2 === 0 ? 1 : 3), 0)
  return base + ((10 - (suma % 10)) % 10)
}

export const MOTIVOS_ANULACION = [
  'El cliente cambió de opinión',
  'Se cobró un producto de más',
  'Error en el método de pago',
  'Producto dañado, se devolvió'
]

export const GASTOS_MENORES = [
  { motivo: 'Pago de garrafón de agua', monto: 250 },
  { motivo: 'Compra de bolsas plásticas', monto: 400 },
  { motivo: 'Pasaje para ir al banco', monto: 150 },
  { motivo: 'Artículos de limpieza para el local', monto: 325 }
]
