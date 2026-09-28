import type { authClient } from '~/utils/auth-client'

export type UsuarioSesion = typeof authClient.$Infer.Session.user

// Usuario de la sesión, fijado por el middleware tanto en SSR como en el cliente
// (así el render del servidor y la hidratación coinciden).
export function useUsuario() {
  const usuario = useState<UsuarioSesion | null>('usuario', () => null)
  const esAdmin = computed(() => usuario.value?.role === 'admin')
  return { usuario, esAdmin }
}
