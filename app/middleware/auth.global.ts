import { authClient } from '~/utils/auth-client'

declare module '#app' {
  interface PageMeta {
    /** Página accesible sin sesión (solo /login) */
    public?: boolean
    /** Página exclusiva del rol admin */
    admin?: boolean
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch)

  if (to.meta.public) {
    if (session.value && to.path === '/login') {
      return navigateTo('/')
    }
    return
  }

  if (!session.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  const esAdmin = session.value.user.role === 'admin'
  if (to.meta.admin && !esAdmin) {
    return navigateTo('/')
  }

  const { estado, cargar } = useTiendaActiva()
  await cargar()

  // Con varias tiendas y sin tienda activa (o sin tiendas asignadas) se exige elegir
  const sinTiendas = !esAdmin && estado.value.tiendas.length === 0
  if ((estado.value.requiereSeleccion || sinTiendas) && to.path !== '/elegir-tienda') {
    return navigateTo({ path: '/elegir-tienda', query: { redirect: to.fullPath } })
  }
})
