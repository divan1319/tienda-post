<script setup lang="ts">
// Layout propio a pantalla completa para la pantalla de venta.
const { usuario } = useUsuario()
</script>

<template>
  <div class="flex h-dvh flex-col bg-default">
    <header class="flex h-14 shrink-0 items-center gap-2 border-b border-default px-2 sm:gap-3 sm:px-4">
      <UButton
        to="/"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        aria-label="Volver al panel"
      />
      <AppLogo compacto-en-movil />
      <span class="hidden font-mono text-xs tracking-widest text-muted uppercase md:inline">Punto de venta</span>
      <div class="ms-auto flex min-w-0 items-center gap-1 sm:gap-2">
        <UButton
          to="/caja"
          label="Caja"
          aria-label="Caja"
          icon="i-lucide-wallet"
          color="neutral"
          variant="ghost"
          :ui="{ label: 'hidden sm:inline' }"
        />
        <TiendaSelector />
        <span
          v-if="usuario"
          class="hidden text-sm text-muted md:inline"
        >{{ usuario.name }}</span>
        <UColorModeButton />
      </div>
    </header>
    <main class="min-h-0 flex-1">
      <slot />
    </main>
  </div>
</template>
