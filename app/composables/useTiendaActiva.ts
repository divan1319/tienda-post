export interface TiendaResumen {
  id: number
  nombre: string
  direccion: string | null
}

interface EstadoTiendas {
  cargado: boolean
  tiendas: TiendaResumen[]
  tiendaActivaId: number | null
  requiereSeleccion: boolean
}

const estadoInicial = (): EstadoTiendas => ({
  cargado: false,
  tiendas: [],
  tiendaActivaId: null,
  requiereSeleccion: false
})

export function useTiendaActiva() {
  const estado = useState<EstadoTiendas>('tienda-activa', estadoInicial)
  // En SSR reenvía las cookies de la petición original
  const requestFetch = useRequestFetch()

  const tiendaActiva = computed(() =>
    estado.value.tiendas.find(t => t.id === estado.value.tiendaActivaId) ?? null
  )

  async function cargar(forzar = false) {
    if (estado.value.cargado && !forzar) return
    const data = await requestFetch('/api/me/tiendas')
    estado.value = { ...data, cargado: true }
  }

  async function cambiar(tiendaId: number) {
    await $fetch('/api/me/tienda-activa', { method: 'PUT', body: { tiendaId } })
    estado.value.tiendaActivaId = tiendaId
    estado.value.requiereSeleccion = false
    await refreshNuxtData()
  }

  function limpiar() {
    estado.value = estadoInicial()
  }

  return { estado, tiendaActiva, cargar, cambiar, limpiar }
}
