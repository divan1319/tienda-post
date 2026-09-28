<script setup lang="ts">
import { getErrorMessage } from '~/utils/errors'

const { estado, tiendaActiva, cambiar } = useTiendaActiva()
const toast = useToast()
const guardando = ref(false)

const seleccion = computed({
  get: () => estado.value.tiendaActivaId ?? undefined,
  set: async (tiendaId?: number) => {
    if (!tiendaId || tiendaId === estado.value.tiendaActivaId) return
    guardando.value = true
    try {
      await cambiar(tiendaId)
      toast.add({ title: `Tienda activa: ${tiendaActiva.value?.nombre}`, color: 'success' })
    } catch (err) {
      toast.add({ title: getErrorMessage(err, 'No se pudo cambiar la tienda'), color: 'error' })
    } finally {
      guardando.value = false
    }
  }
})
</script>

<template>
  <USelect
    v-if="estado.tiendas.length"
    v-model="seleccion"
    :items="estado.tiendas"
    value-key="id"
    label-key="nombre"
    icon="i-lucide-store"
    placeholder="Elegir tienda"
    :loading="guardando"
    :disabled="estado.tiendas.length === 1"
    class="w-48"
  />
</template>
