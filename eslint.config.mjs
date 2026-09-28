// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultAttributes } from 'eslint-plugin-better-tailwindcss/api/defaults'

export default withNuxt(
  betterTailwindcss.configs['correctness-error'],
  {
    settings: {
      'better-tailwindcss': {
        entryPoint: 'app/assets/css/main.css',
        attributes: [
          ...getDefaultAttributes(),
          ['^v-bind:ui$', [{ match: 'objectValues' }]]
        ]
      }
    },
    rules: {
      // Clases propias: carbon-data-mono (main.css), zona-impresion (print.css)
      // y las del ticket (CSS con scope en TicketVenta.vue)
      'better-tailwindcss/no-unknown-classes': ['error', {
        ignore: ['^carbon-data-mono$', '^zona-impresion$', '^ticket(-[a-z]+)?$']
      }]
    }
  }
)
