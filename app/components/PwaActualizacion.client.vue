<script setup lang="ts">
// Aviso de nueva versión de la PWA. No se recarga sola: en el POS se perdería el
// carrito; el usuario actualiza cuando termina lo que está haciendo.
const { $pwa } = useNuxtApp()
const toast = useToast()

watch(() => $pwa?.needRefresh, (pendiente) => {
  if (!pendiente) return
  toast.add({
    id: 'pwa-actualizacion',
    title: 'Hay una nueva versión de Tienda POS',
    description: 'Actualiza cuando termines la venta o el registro en curso.',
    icon: 'i-lucide-refresh-cw',
    color: 'info',
    duration: 0,
    progress: false,
    actions: [{
      label: 'Actualizar',
      icon: 'i-lucide-rotate-cw',
      onClick: () => {
        $pwa?.updateServiceWorker(true)
      }
    }]
  })
}, { immediate: true })
</script>

<template>
  <span class="hidden" />
</template>
