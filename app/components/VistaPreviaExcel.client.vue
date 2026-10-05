<script setup lang="ts">
// Vista previa del Excel en el navegador con el adaptador Vue de SpreadsheetPreview
// (https://spreadsheetpreview.com/docs#vue). El archivo se lee en el navegador; la imagen
// del sello se carga desde cdn.spreadsheetpreview.com. El paquete pesa más de 1 MB: se
// carga solo cuando se muestra la vista previa.
// Licencia: sin licencia comercial se usa la edición comunitaria, que exige dejar
// visible el sello «Powered by SpreadsheetPreview» (no pasar commercial-license).
defineProps<{ archivo: File }>()

const SpreadsheetPreview = defineAsyncComponent(() => import('@datagridxl/spreadsheet-preview/vue'))
const colorMode = useColorMode()
</script>

<template>
  <!-- shrink-0: dentro del panel (flex en columna) el overflow-hidden lo dejaría encoger -->
  <div class="shrink-0 overflow-hidden border border-default">
    <SpreadsheetPreview
      :file="archivo"
      :title="archivo.name"
      :theme="colorMode.value === 'dark' ? 'dark' : 'light'"
      height="420px"
    />
  </div>
</template>
