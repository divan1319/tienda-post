<script setup lang="ts">
// Paginación de los listados. En móvil se ocultan «primera» y «última» y se
// muestra una página a cada lado de la actual, para que quepa sin desbordar.
defineProps<{
  total: number
  itemsPerPage: number
}>()

const page = defineModel<number>('page', { required: true })
</script>

<template>
  <div class="flex justify-center sm:justify-end">
    <UPagination
      v-model:page="page"
      :total="total"
      :items-per-page="itemsPerPage"
      :sibling-count="1"
      :ui="{ first: 'hidden sm:inline-flex', last: 'hidden sm:inline-flex' }"
    />
  </div>
</template>
