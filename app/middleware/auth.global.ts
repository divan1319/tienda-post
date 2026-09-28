import { authClient } from '~/utils/auth-client'

declare module '#app' {
  interface PageMeta {
    /** Página accesible sin sesión (solo /login) */
    public?: boolean
    /** Página exclusiva del rol admin */
    admin?: boolean
  }
}

// En SSR `useSession(useFetch)` reenvía las cookies de la petición; en el cliente
// se pide la sesión fresca, porque el resultado de useFetch queda en caché
// (tras iniciar sesión seguiría devolviendo la sesión nula anterior).
async function obtenerSesion() {
  if (import.meta.server) {
    const { data } = await authClient.useSession(useFetch)
    return data.value
  }
  const { data } = await authClient.getSession()
  return data
}

export default defineNuxtRouteMiddleware(async (to) => {
  // UDashboardPanel no tiene un único elemento raíz, así que las páginas del
  // dashboard van sin transición de página (las de /login y /elegir-tienda sí la usan)
  if ((to.meta.layout ?? 'default') === 'default') {
    to.meta.pageTransition = false
  }

  const session = await obtenerSesion()
  const { usuario } = useUsuario()
  usuario.value = session?.user ?? null

  if (to.meta.public) {
    if (session && to.path === '/login') {
      return navigateTo('/')
    }
    return
  }

  if (!session) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  const esAdmin = session.user.role === 'admin'
  if (to.meta.admin && !esAdmin) {
    return navigateTo('/')
  }

  const { estado, cargar } = useTiendaActiva()
  await cargar()

  // Las páginas de administración no dependen de la tienda activa
  if (to.meta.admin) return

  // Con varias tiendas y sin tienda activa (o sin tiendas asignadas) se exige elegir
  const sinTiendas = !esAdmin && estado.value.tiendas.length === 0
  if ((estado.value.requiereSeleccion || sinTiendas) && to.path !== '/elegir-tienda') {
    return navigateTo({ path: '/elegir-tienda', query: { redirect: to.fullPath } })
  }
})
