import { authClient } from '~/utils/auth-client'

declare module '#app' {
  interface PageMeta {
    /** Página accesible sin sesión (solo /login) */
    public?: boolean
    /** Página exclusiva del rol admin */
    admin?: boolean
  }
}

type Sesion = typeof authClient.$Infer.Session

/** Solo acepta una sesión real: cualquier otra respuesta (null, HTML, error) cuenta como sin sesión. */
function comoSesion(valor: unknown): Sesion | null {
  const s = valor as Sesion | null | undefined
  return s && typeof s === 'object' && s.user && typeof s.user === 'object' ? s : null
}

// En SSR se consulta la ruta interna con useRequestFetch, que reenvía las cookies de
// la petición original. No se usa authClient en el servidor: sin `baseURL`, Better Auth
// arma la URL con VERCEL_URL (la URL del despliegue) y la pide por la red, sin cookies;
// si ese dominio responde otra cosa (p. ej. la página de Deployment Protection),
// `session.user` llega undefined.
// En el cliente se pide la sesión fresca con getSession (el resultado de useFetch
// quedaría en caché y tras iniciar sesión seguiría devolviendo la sesión nula anterior).
async function obtenerSesion(): Promise<Sesion | null> {
  try {
    if (import.meta.server) {
      return comoSesion(await useRequestFetch()('/api/auth/get-session'))
    }
    const { data } = await authClient.getSession()
    return comoSesion(data)
  } catch {
    return null
  }
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
