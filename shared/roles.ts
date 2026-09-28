import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access'

// Roles del plugin `admin` de Better Auth. La autorización del dominio (tiendas,
// ventas, inventario…) se resuelve con los helpers de Nitro, no con permisos extra.
export const ROLES = ['admin', 'vendedora'] as const
export type Rol = typeof ROLES[number]

export const ac = createAccessControl(defaultStatements)

export const roles = {
  // Gestión de cuentas (crear, rol, contraseña, desactivar)
  admin: ac.newRole(adminAc.statements),
  // Sin permisos sobre otras cuentas
  vendedora: ac.newRole({ user: [], session: [] })
}
