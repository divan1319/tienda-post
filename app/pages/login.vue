<script setup lang="ts">
import { z } from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { authClient } from '~/utils/auth-client'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({
  layout: 'auth',
  public: true
})

useSeoMeta({ title: 'Iniciar sesión' })

const route = useRoute()
const { limpiar } = useTiendaActiva()

const errorMessage = ref('')
const cargando = ref(false)

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Correo electrónico',
    placeholder: 'tu@correo.com',
    required: true
  },
  {
    name: 'password',
    type: 'password',
    label: 'Contraseña',
    placeholder: '••••••••',
    required: true
  }
]

const schema = z.object({
  email: z.email('Correo no válido'),
  password: z.string().min(1, 'Ingresa tu contraseña')
})

type Schema = z.output<typeof schema>

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  errorMessage.value = ''
  cargando.value = true

  try {
    const { error } = await authClient.signIn.email({
      email: payload.data.email.trim(),
      password: payload.data.password
    })

    if (error) {
      errorMessage.value = error.status === 403
        ? (error.message || 'Tu cuenta está desactivada.')
        : 'El correo o la contraseña son incorrectos.'
      return
    }

    limpiar()
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/'
    await navigateTo(redirect)
  } catch (err) {
    errorMessage.value = getErrorMessage(err, 'Error al iniciar sesión')
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <UPageCard variant="outline">
    <UAuthForm
      :fields="fields"
      :schema="schema"
      :loading="cargando"
      title="Iniciar sesión"
      description="Las cuentas las crea el administrador."
      icon="i-lucide-store"
      :submit="{ label: 'Entrar', block: true }"
      @submit="onSubmit"
    >
      <template #validation>
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errorMessage"
        />
      </template>
    </UAuthForm>
  </UPageCard>
</template>
