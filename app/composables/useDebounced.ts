/** Copia de `source` que se actualiza cuando deja de cambiar durante `ms`. */
export function useDebounced<T>(source: Ref<T>, ms = 300) {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = value
    }, ms)
  })

  onScopeDispose(() => clearTimeout(timer))
  return debounced
}
