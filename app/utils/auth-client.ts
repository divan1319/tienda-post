import { createAuthClient } from 'better-auth/vue'
import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { ac, roles } from '#shared/roles'

export const authClient = createAuthClient({
  plugins: [
    adminClient({ ac, roles }),
    inferAdditionalFields({
      user: {
        tiendaActivaId: { type: 'number', required: false, input: false }
      }
    })
  ]
})

export const { signIn, signOut, useSession } = authClient
