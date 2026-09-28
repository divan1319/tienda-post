<script setup lang="ts">
// Layout propio a pantalla completa para la pantalla de venta.
const { usuario } = useUsuario()
</script>

<template>
  <div class="flex h-dvh flex-col bg-default">
    <header class="flex h-14 shrink-0 items-center gap-3 border-b border-default px-4">
      <UButton
        to="/"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        aria-label="Volver al panel"
      />
      <AppLogo />
      <span class="font-mono text-xs tracking-widest text-muted uppercase">Punto de venta</span>
      <div class="ms-auto flex items-center gap-2">
        <UButton
          to="/caja"
          label="Caja"
          icon="i-lucide-wallet"
          color="neutral"
          variant="ghost"
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
