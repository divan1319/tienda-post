export interface FiltrosReporte {
  tiendaId?: string
  periodo: Periodo
  desde: string
  hasta: string
}

/** Consulta de la API a partir de los filtros de la página de reportes. */
export function consultaReporte(filtros: Ref<FiltrosReporte>) {
  return computed(() => ({
    tiendaId: filtros.value.tiendaId,
    periodo: filtros.value.periodo,
    desde: filtros.value.desde,
    hasta: filtros.value.hasta
  }))
}
