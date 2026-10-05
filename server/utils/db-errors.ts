import { createError } from 'h3'

interface DatabaseErrorLike {
  code?: string
  detail?: string
  constraint?: string
  message?: string
  statusCode?: number
  statusMessage?: string
  cause?: DatabaseErrorLike
}

export function handleDbError(err: unknown): never {
  const dbErr = err as DatabaseErrorLike
  const rootErr = dbErr?.cause || dbErr

  // Si ya es un error HTTP generado explícitamente (ej: 400, 401, 403, 404)
  if (dbErr?.statusCode && dbErr.statusCode < 500) {
    throw err
  }

  const code = rootErr?.code || dbErr?.code
  const detail = (rootErr?.detail || dbErr?.detail || '') + ' ' + (rootErr?.message || dbErr?.message || '')
  const constraint = rootErr?.constraint || dbErr?.constraint || ''

  // 1. Violación de restricción única (Clave o dato duplicado)
  if (code === '23505' || detail.toLowerCase().includes('duplicate key') || detail.toLowerCase().includes('unique constraint')) {
    let friendlyMessage = 'Ya existe un registro con estos datos en la base de datos.'

    if (constraint.includes('codigo_barras') || detail.includes('codigo_barras')) {
      friendlyMessage = 'Ya existe un producto con este código de barras.'
    } else if (constraint.includes('categoria_codigo') || detail.includes('(codigo)')) {
      friendlyMessage = 'Ya existe una categoría con este código.'
    } else if (constraint.includes('nombre') || detail.includes('(nombre)')) {
      friendlyMessage = 'Ya existe un registro con este nombre.'
    } else if (constraint.includes('email') || detail.includes('email')) {
      friendlyMessage = 'Ya existe un usuario registrado con este correo electrónico.'
    }

    throw createError({
      statusCode: 409,
      statusMessage: friendlyMessage,
      message: friendlyMessage,
      data: {
        code: 'DUPLICATE_ENTRY',
        detail: process.env.NODE_ENV === 'development' ? detail.trim() : undefined
      }
    })
  }

  // 2. Violación de clave foránea
  if (code === '23503' || detail.toLowerCase().includes('foreign key constraint')) {
    const friendlyMessage = 'No se puede completar la operación porque hace referencia a un registro que no existe o está protegido por dependencias asociadas.'
    throw createError({
      statusCode: 400,
      statusMessage: friendlyMessage,
      message: friendlyMessage,
      data: {
        code: 'FOREIGN_KEY_VIOLATION'
      }
    })
  }

  // 3. Violación de campo no nulo
  if (code === '23502' || detail.toLowerCase().includes('not-null constraint')) {
    const friendlyMessage = 'Faltan campos obligatorios para guardar la información.'
    throw createError({
      statusCode: 400,
      statusMessage: friendlyMessage,
      message: friendlyMessage,
      data: {
        code: 'NOT_NULL_VIOLATION'
      }
    })
  }

  // 4. Dato o formato inválido para la base de datos
  if (code === '22P02' || detail.toLowerCase().includes('invalid input syntax')) {
    const friendlyMessage = 'El formato de los datos proporcionados no es válido para la base de datos.'
    throw createError({
      statusCode: 400,
      statusMessage: friendlyMessage,
      message: friendlyMessage,
      data: {
        code: 'INVALID_DATA'
      }
    })
  }

  // 5. Otros errores no controlados
  console.error('[Database Error]', err)
  throw createError({
    statusCode: 500,
    statusMessage: 'Error al procesar la solicitud en la base de datos',
    message: 'Error al procesar la solicitud en la base de datos',
    data: {
      code: 'DB_UNKNOWN_ERROR'
    }
  })
}
