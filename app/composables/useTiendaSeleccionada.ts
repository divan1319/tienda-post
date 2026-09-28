/**
 * Tienda elegida en las pantallas de admin que trabajan sobre una tienda concreta
 * (productos, entradas, ajustes, kardex). Arranca en la tienda activa.
 */
export function useTiendaSeleccionada() {
  const { estado } = useTiendaActiva()
  const tiendaId = useState<number | undefined>('tienda-seleccionada', () =>
    estado.value.tiendaActivaId ?? estado.value.tiendas[0]?.id
  )

  // Si la tienda elegida deja de estar disponible, vuelve a la activa
  watch(() => estado.value.tiendas, (tiendas) => {
    if (!tiendas.some(t => t.id === tiendaId.value)) {
      tiendaId.value = estado.value.tiendaActivaId ?? tiendas[0]?.id
    }
  })

  const items = computed(() => estado.value.tiendas.map(t => ({ label: t.nombre, value: t.id })))

  return { tiendaId, items }
}
