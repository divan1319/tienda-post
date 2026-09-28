import { getErrorMessage } from '~/utils/errors'

/** Sube el comprobante (foto o PDF) de una compra; avisa si falla sin perder la compra. */
export function useComprobante() {
  const toast = useToast()

  async function subir(compraId: number, archivo: File) {
    const form = new FormData()
    form.append('archivo', archivo)
    try {
      await $fetch(`/api/compras/${compraId}/comprobante`, { method: 'POST', body: form })
      return true
    } catch (err) {
      toast.add({ title: getErrorMessage(err, 'La compra se guardó, pero no se pudo subir el comprobante'), color: 'warning' })
      return false
    }
  }

  return { subir }
}
