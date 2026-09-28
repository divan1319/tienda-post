<script setup lang="ts">
import { authClient } from '~/utils/auth-client'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ layout: 'auth' })

useSeoMeta({ title: 'Elegir tienda' })

const route = useRoute()
const toast = useToast()
const { estado, cambiar, limpiar } = useTiendaActiva()

const seleccion = ref<number | undefined>(estado.value.tiendaActivaId ?? undefined)
const guardando = ref(false)

const items = computed(() => estado.value.tiendas.map(t => ({
  value: t.id,
  label: t.nombre,
  description: t.direccion ?? undefined
})))

async function continuar() {
  if (!seleccion.value) return
  guardando.value = true
  try {
    await cambiar(seleccion.value)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/'
    await navigateTo(redirect)
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo guardar la tienda'), color: 'error' })
  } finally {
    guardando.value = false
  }
}

async function cerrarSesion() {
  await authClient.signOut()
  limpiar()
  await navigateTo('/login')
}
</script>

<template>
  <UPageCard variant="outline">
    <div class="space-y-5">
      <div class="space-y-1">
        <SectionLabel>Tienda activa</SectionLabel>
        <h1 class="text-xl font-semibold text-highlighted">
          ¿En qué tienda trabajas hoy?
        </h1>
        <p class="text-sm text-muted">
          Puedes cambiarla después desde la barra superior.
        </p>
      </div>

      <UEmpty
        v-if="!items.length"
        icon="i-lucide-store"
        title="Sin tiendas asignadas"
        description="Pide al administrador que te asigne una tienda."
        variant="naked"
      />

      <template v-else>
        <URadioGroup
          v-model="seleccion"
          :items="items"
          variant="card"
        />

        <UButton
          label="Continuar"
          block
          :disabled="!seleccion"
          :loading="guardando"
          @click="continuar"
        />
      </template>

      <UButton
        label="Cerrar sesión"
        color="neutral"
        variant="ghost"
        icon="i-lucide-log-out"
        block
        @click="cerrarSesion"
      />
    </div>
  </UPageCard>
</template>
