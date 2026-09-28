import { createAuth, type Auth } from '../lib/auth'

let _auth: Auth | null = null

export function useAuth(): Auth {
  if (!_auth) {
    const config = getServerConfig()
    _auth = createAuth(useDb(), {
      secret: config.betterAuthSecret,
      baseURL: config.betterAuthUrl
    })
  }
  return _auth
}
