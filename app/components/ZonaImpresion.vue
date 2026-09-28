<script setup lang="ts">
// Contenido que solo aparece al imprimir (ver assets/css/print.css).
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="zona-impresion">
        <slot />
      </div>
    </Teleport>
  </ClientOnly>
</template>
