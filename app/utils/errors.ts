interface FetchErrorData {
  statusCode?: number
  statusMessage?: string
  message?: string
  data?: {
    code?: string
    detail?: string
  }
}

interface FetchErrorLike {
  data?: FetchErrorData | string
  statusMessage?: string
  message?: string
  statusCode?: number
}

/**
 * Extrae un mensaje de error legible y específico para el usuario,
 * descartando textos genéricos del framework como "Internal Server Error"
 * o "server error".
 */
export function getErrorMessage(err: unknown, defaultMessage = 'Ha ocurrido un error inesperado'): string {
  if (!err) return defaultMessage

  if (typeof err === 'string') {
    return err.trim() || defaultMessage
  }

  const fetchErr = err as FetchErrorLike

  // 1. Si data es un string (a veces Nitro envía texto plano)
  if (typeof fetchErr.data === 'string' && fetchErr.data.trim()) {
    const trimmed = fetchErr.data.trim()
    if (!isGenericServerError(trimmed)) {
      return trimmed
    }
  }

  // 2. Extraer de fetchErr.data si es un objeto JSON estructurado
  if (typeof fetchErr.data === 'object' && fetchErr.data !== null) {
    const dataObj = fetchErr.data as FetchErrorData
    // Prioridad 1: data.message específico
    if (dataObj.message && !isGenericServerError(dataObj.message)) {
      return dataObj.message
    }
    // Prioridad 2: data.statusMessage específico
    if (dataObj.statusMessage && !isGenericServerError(dataObj.statusMessage)) {
      return dataObj.statusMessage
    }
  }

  // 3. Extraer de statusMessage directo en el objeto de error
  if (fetchErr.statusMessage && !isGenericServerError(fetchErr.statusMessage)) {
    return fetchErr.statusMessage
  }

  // 4. Extraer de message directo comprobando patrones comunes
  if (fetchErr.message) {
    const msg = fetchErr.message

    if (msg.includes('distrito_anio_idx') || (msg.includes('distrito_id') && msg.includes('anio'))) {
      return 'Ya existe una edición registrada para este distrito en el año especificado.'
    }
    if (msg.includes('slug') && msg.toLowerCase().includes('unique')) {
      return 'Ya existe un distrito registrado con este identificador (slug).'
    }
    if (msg.toLowerCase().includes('duplicate key') || msg.toLowerCase().includes('unique constraint')) {
      return 'Ya existe un registro con estos datos en el sistema.'
    }
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return 'No se pudo conectar con el servidor. Por favor verifica tu conexión a internet.'
    }

    if (!isGenericServerError(msg)) {
      return msg
    }
  }

  return defaultMessage
}

function isGenericServerError(msg: string): boolean {
  const lower = msg.toLowerCase().trim()
  return (
    lower === 'internal server error'
    || lower === 'server error'
    || lower === 'request error'
    || lower === 'error'
    || lower.startsWith('fetcherror: 500')
    || lower.includes('status code 500')
  )
}
