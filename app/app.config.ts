export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'zinc'
    },
    button: {
      defaultVariants: {
        size: 'sm'
      }
    },
    input: {
      defaultVariants: {
        size: 'sm'
      }
    },
    select: {
      defaultVariants: {
        size: 'sm'
      }
    },
    inputNumber: {
      defaultVariants: {
        size: 'sm'
      }
    },
    inputMenu: {
      defaultVariants: {
        size: 'sm'
      }
    },
    selectMenu: {
      defaultVariants: {
        size: 'sm'
      }
    },
    textarea: {
      defaultVariants: {
        size: 'sm'
      }
    },
    dashboardPanel: {
      slots: {
        // El cuerpo del panel es flex-col con scroll: sin esto, las tarjetas (overflow-hidden)
        // y las tablas (overflow-auto) se encogen y recortan su contenido cuando la
        // página no cabe en la pantalla, en vez de hacer scroll la página completa
        body: '*:shrink-0'
      }
    },
    table: {
      slots: {
        // Columna fija (acciones, ver ACCIONES_FIJAS) con fondo opaco: al desplazar
        // la tabla en horizontal no se transparenta lo que pasa por debajo
        th: 'data-[pinned=right]:bg-default',
        td: 'data-[pinned=right]:bg-default'
      }
    }
  }
})
