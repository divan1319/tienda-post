<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TurnoConResumen } from '#shared/types/ventas'
import { getErrorMessage } from '~/utils/errors'
import { formatFechaHora } from '~/utils/fechas'

useSeoMeta({ title: 'Caja' })

const toast = useToast()
const { esAdmin } = useUsuario()
const { estado } = useTiendaActiva()

// ---------- Mi turno ----------

const { data: actual, refresh: refreshActual } = await useFetch('/api/caja/turno-actual')
const miTurno = computed(() => (actual.value?.turno ?? null) as TurnoConResumen | null)

const montoInicial = ref<number | undefined>()
const abriendo = ref(false)

async function abrirTurno() {
  if (montoInicial.value === undefined) return
  abriendo.value = true
  try {
    await $fetch('/api/caja/turnos', { method: 'POST', body: { montoInicialCentavos: dolaresACentavos(montoInicial.value) } })
    toast.add({ title: 'Turno abierto', color: 'success' })
    montoInicial.value = undefined
    await Promise.all([refreshActual(), refreshTurnos(), refreshAbiertos()])
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo abrir el turno'), color: 'error' })
  } finally {
    abriendo.value = false
  }
}

const contado = ref<number | undefined>()
const notaCierre = ref('')
const cerrando = ref(false)
const confirmarCierre = ref(false)

const diferenciaPrevia = computed(() => {
  if (!miTurno.value || contado.value === undefined) return null
  return dolaresACentavos(contado.value) - miTurno.value.resumen.efectivoEsperadoCentavos
})

async function cerrarTurno() {
  if (!miTurno.value || contado.value === undefined) return
  cerrando.value = true
  try {
    const cerrado = await $fetch<TurnoConResumen>(`/api/caja/turnos/${miTurno.value.id}/cerrar`, {
      method: 'POST',
      body: { efectivoContadoCentavos: dolaresACentavos(contado.value), nota: notaCierre.value || null }
    })
    toast.add({ title: 'Turno cerrado', color: 'success' })
    confirmarCierre.value = false
    contado.value = undefined
    notaCierre.value = ''
    await Promise.all([refreshActual(), refreshTurnos(), refreshAbiertos()])
    await verTurno(cerrado.id)
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo cerrar el turno'), color: 'error' })
  } finally {
    cerrando.value = false
  }
}

// ---------- Turnos (cortes) ----------

const tiendaFiltro = ref<string>('todas')
const tiendaFiltroItems = computed(() => [
  { label: 'Todas las tiendas', value: 'todas' },
  ...estado.value.tiendas.map(t => ({ label: t.nombre, value: String(t.id) }))
])
const tiendaQuery = computed(() => tiendaFiltro.value === 'todas' ? undefined : tiendaFiltro.value)

const POR_PAGINA = 20
const pagina = ref(1)
watch(tiendaFiltro, () => {
  pagina.value = 1
})

const { data: turnos, status: turnosStatus, refresh: refreshTurnos } = await useFetch('/api/caja/turnos', {
  query: computed(() => ({
    abiertos: 'false',
    tiendaId: tiendaQuery.value,
    limit: POR_PAGINA,
    offset: (pagina.value - 1) * POR_PAGINA
  }))
})

type TurnoFila = NonNullable<typeof turnos.value>['items'][number]

const columnasCortes: TableColumn<TurnoFila>[] = [
  { accessorKey: 'id', header: '#' },
  { accessorKey: 'tiendaNombre', header: 'Tienda' },
  { accessorKey: 'usuario', header: 'Usuario' },
  { accessorKey: 'cerradoAt', header: 'Cerrado' },
  { accessorKey: 'efectivoEsperadoCentavos', header: 'Esperado' },
  { accessorKey: 'efectivoContadoCentavos', header: 'Contado' },
  { accessorKey: 'diferenciaCentavos', header: 'Diferencia' },
  // Sin `header`: un string vacío provoca un desajuste de hidratación en UTable
  { id: 'acciones' }
]

// Detalle de un turno (y corte imprimible)
const turnoVisto = ref<TurnoConResumen | null>(null)
async function verTurno(id: number) {
  try {
    turnoVisto.value = await $fetch<TurnoConResumen>(`/api/caja/turnos/${id}`)
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo cargar el turno'), color: 'error' })
  }
}

function imprimir() {
  window.print()
}

// ---------- Admin: turnos abiertos y salidas de efectivo ----------

const { data: abiertos, refresh: refreshAbiertos } = await useFetch('/api/caja/turnos', {
  query: computed(() => ({ abiertos: 'true', tiendaId: tiendaQuery.value, limit: 100 })),
  immediate: esAdmin.value
})

const columnasAbiertos: TableColumn<TurnoFila>[] = [
  { accessorKey: 'id', header: '#' },
  { accessorKey: 'tiendaNombre', header: 'Tienda' },
  { accessorKey: 'usuario', header: 'Usuario' },
  { accessorKey: 'abiertoAt', header: 'Abierto' },
  { accessorKey: 'montoInicialCentavos', header: 'Inicial' },
  { id: 'acciones' }
]

const salidaTurno = ref<TurnoConResumen | null>(null)
const salidaMonto = ref<number | undefined>()
const salidaMotivo = ref('')
const registrandoSalida = ref(false)

const errorSalida = computed(() => {
  if (!salidaTurno.value || salidaMonto.value === undefined) return null
  return validarMontoSalida(dolaresACentavos(salidaMonto.value), salidaTurno.value.resumen.efectivoEsperadoCentavos)
})

async function abrirSalida(id: number) {
  salidaMonto.value = undefined
  salidaMotivo.value = ''
  try {
    salidaTurno.value = await $fetch<TurnoConResumen>(`/api/caja/turnos/${id}`)
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo cargar el turno'), color: 'error' })
  }
}

async function registrarSalida() {
  if (!salidaTurno.value || salidaMonto.value === undefined || errorSalida.value) return
  registrandoSalida.value = true
  try {
    await $fetch(`/api/caja/turnos/${salidaTurno.value.id}/salidas`, {
      method: 'POST',
      body: {
        tiendaId: salidaTurno.value.tiendaId,
        montoCentavos: dolaresACentavos(salidaMonto.value),
        motivo: salidaMotivo.value
      }
    })
    toast.add({ title: 'Salida de efectivo registrada', color: 'success' })
    salidaTurno.value = null
    await refreshActual()
  } catch (err) {
    toast.add({ title: getErrorMessage(err, 'No se pudo registrar la salida'), color: 'error' })
  } finally {
    registrandoSalida.value = false
  }
}

function colorDiferencia(d: number | null) {
  if (d === null || d === 0) return 'text-success'
  return d < 0 ? 'text-error' : 'text-warning'
}
</script>

<template>
  <UDashboardPanel id="caja">
    <template #header>
      <PanelNavbar title="Caja" />
    </template>

    <template #body>
      <!-- Mi turno -->
      <div class="grid gap-4 xl:grid-cols-2">
        <UCard variant="outline">
          <template #header>
            <div class="flex items-center justify-between">
              <SectionLabel>Mi turno</SectionLabel>
              <UBadge
                :label="miTurno ? 'Abierto' : 'Sin turno'"
                :color="miTurno ? 'success' : 'neutral'"
                variant="subtle"
              />
            </div>
          </template>

          <ResumenTurnoCard
            v-if="miTurno"
            :turno="miTurno"
          />
          <div
            v-else
            class="space-y-3"
          >
            <p class="text-sm text-muted">
              No tienes un turno abierto en esta tienda. Registra el efectivo inicial para empezar a vender.
            </p>
            <form
              class="flex items-end gap-2"
              @submit.prevent="abrirTurno"
            >
              <UFormField
                label="Efectivo inicial"
                class="flex-1"
              >
                <UInputNumber
                  v-model="montoInicial"
                  :min="0"
                  :step="0.01"
                  :format-options="{ style: 'currency', currency: 'USD' }"
                  class="w-full"
                />
              </UFormField>
              <UButton
                type="submit"
                label="Abrir turno"
                :loading="abriendo"
                :disabled="montoInicial === undefined"
              />
            </form>
          </div>
        </UCard>

        <UCard
          v-if="miTurno"
          variant="outline"
        >
          <template #header>
            <SectionLabel>Cerrar turno</SectionLabel>
          </template>
          <form
            class="space-y-4"
            @submit.prevent="confirmarCierre = true"
          >
            <UFormField
              label="Efectivo contado"
              required
              help="Cuenta el efectivo de la caja e ingrésalo."
            >
              <UInputNumber
                v-model="contado"
                :min="0"
                :step="0.01"
                :format-options="{ style: 'currency', currency: 'USD' }"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Nota">
              <UTextarea
                v-model="notaCierre"
                :rows="2"
                placeholder="Opcional"
                class="w-full"
              />
            </UFormField>
            <div
              v-if="diferenciaPrevia !== null"
              class="carbon-data-mono flex justify-between text-sm"
            >
              <span class="text-muted">Diferencia</span>
              <span
                class="font-semibold"
                :class="colorDiferencia(diferenciaPrevia)"
              >
                {{ diferenciaPrevia > 0 ? '+' : '' }}{{ formatUSD(diferenciaPrevia) }}
              </span>
            </div>
            <div class="flex gap-2">
              <UButton
                to="/pos"
                label="Ir a vender"
                icon="i-lucide-shopping-cart"
                color="neutral"
                variant="outline"
              />
              <UButton
                type="submit"
                label="Cerrar turno"
                :disabled="contado === undefined"
              />
            </div>
          </form>
        </UCard>
      </div>

      <!-- Admin: turnos abiertos -->
      <template v-if="esAdmin">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Turnos abiertos</SectionLabel>
          <USelect
            v-model="tiendaFiltro"
            :items="tiendaFiltroItems"
            class="w-52"
          />
        </div>
        <UTable
          :data="abiertos?.items ?? []"
          :columns="columnasAbiertos"
          empty="No hay turnos abiertos."
          class="border border-default"
        >
          <template #id-cell="{ row }">
            <span class="carbon-data-mono">{{ row.original.id }}</span>
          </template>
          <template #abiertoAt-cell="{ row }">
            <span class="carbon-data-mono">{{ formatFechaHora(row.original.abiertoAt) }}</span>
          </template>
          <template #montoInicialCentavos-cell="{ row }">
            <span class="carbon-data-mono">{{ formatUSD(row.original.montoInicialCentavos) }}</span>
          </template>
          <template #acciones-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                label="Ver"
                icon="i-lucide-eye"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="verTurno(row.original.id)"
              />
              <UButton
                label="Salida de efectivo"
                icon="i-lucide-hand-coins"
                size="xs"
                color="neutral"
                variant="outline"
                @click="abrirSalida(row.original.id)"
              />
            </div>
          </template>
        </UTable>
      </template>

      <!-- Cortes -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>{{ esAdmin ? 'Cortes de caja' : 'Mis turnos anteriores' }}</SectionLabel>
        <USelect
          v-if="esAdmin"
          v-model="tiendaFiltro"
          :items="tiendaFiltroItems"
          class="w-52"
        />
      </div>
      <UTable
        :data="turnos?.items ?? []"
        :columns="columnasCortes"
        :loading="turnosStatus === 'pending'"
        empty="Aún no hay turnos cerrados."
        class="border border-default"
      >
        <template #id-cell="{ row }">
          <span class="carbon-data-mono">{{ row.original.id }}</span>
        </template>
        <template #cerradoAt-cell="{ row }">
          <span class="carbon-data-mono">{{ row.original.cerradoAt ? formatFechaHora(row.original.cerradoAt) : '—' }}</span>
        </template>
        <template #efectivoEsperadoCentavos-cell="{ row }">
          <span class="carbon-data-mono">{{ formatUSD(row.original.efectivoEsperadoCentavos ?? 0) }}</span>
        </template>
        <template #efectivoContadoCentavos-cell="{ row }">
          <span class="carbon-data-mono">{{ formatUSD(row.original.efectivoContadoCentavos ?? 0) }}</span>
        </template>
        <template #diferenciaCentavos-cell="{ row }">
          <span
            class="carbon-data-mono font-semibold"
            :class="colorDiferencia(row.original.diferenciaCentavos)"
          >
            {{ (row.original.diferenciaCentavos ?? 0) > 0 ? '+' : '' }}{{ formatUSD(row.original.diferenciaCentavos ?? 0) }}
          </span>
        </template>
        <template #acciones-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              icon="i-lucide-eye"
              color="neutral"
              variant="ghost"
              aria-label="Ver corte"
              @click="verTurno(row.original.id)"
            />
          </div>
        </template>
      </UTable>
      <div
        v-if="(turnos?.total ?? 0) > POR_PAGINA"
        class="flex justify-end"
      >
        <UPagination
          v-model:page="pagina"
          :total="turnos?.total ?? 0"
          :items-per-page="POR_PAGINA"
        />
      </div>

      <!-- Confirmar cierre -->
      <UModal
        v-model:open="confirmarCierre"
        title="¿Cerrar el turno?"
        description="El turno cerrado queda de solo lectura."
      >
        <template #body>
          <div
            v-if="miTurno && contado !== undefined"
            class="carbon-data-mono space-y-1 text-sm"
          >
            <div class="flex justify-between">
              <span class="text-muted">Esperado</span><span>{{ formatUSD(miTurno.resumen.efectivoEsperadoCentavos) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Contado</span><span>{{ formatUSD(dolaresACentavos(contado)) }}</span>
            </div>
            <div
              class="flex justify-between font-semibold"
              :class="colorDiferencia(diferenciaPrevia)"
            >
              <span>Diferencia</span><span>{{ formatUSD(diferenciaPrevia ?? 0) }}</span>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="confirmarCierre = false"
            />
            <UButton
              label="Cerrar turno"
              :loading="cerrando"
              @click="cerrarTurno"
            />
          </div>
        </template>
      </UModal>

      <!-- Detalle de turno / corte -->
      <UModal
        :open="!!turnoVisto"
        :title="turnoVisto ? `Turno #${turnoVisto.id}` : ''"
        @update:open="(v) => { if (!v) turnoVisto = null }"
      >
        <template #body>
          <ResumenTurnoCard
            v-if="turnoVisto"
            :turno="turnoVisto"
          />
          <ZonaImpresion v-if="turnoVisto">
            <CorteImpreso :turno="turnoVisto" />
          </ZonaImpresion>
        </template>
        <template #footer>
          <div class="flex w-full justify-end">
            <UButton
              label="Imprimir"
              icon="i-lucide-printer"
              color="neutral"
              variant="outline"
              @click="imprimir"
            />
          </div>
        </template>
      </UModal>

      <!-- Salida de efectivo (admin) -->
      <UModal
        :open="!!salidaTurno"
        title="Salida de efectivo"
        :description="salidaTurno ? `Turno #${salidaTurno.id} · ${salidaTurno.tiendaNombre} · ${salidaTurno.usuario}` : undefined"
        @update:open="(v) => { if (!v) salidaTurno = null }"
      >
        <template #body>
          <form
            v-if="salidaTurno"
            id="form-salida"
            class="space-y-4"
            @submit.prevent="registrarSalida"
          >
            <p class="carbon-data-mono text-sm">
              <span class="text-muted">Disponible en caja:</span>
              {{ formatUSD(salidaTurno.resumen.efectivoEsperadoCentavos) }}
            </p>
            <UFormField
              label="Monto"
              required
              :error="errorSalida ?? undefined"
            >
              <UInputNumber
                v-model="salidaMonto"
                :min="0"
                :step="0.01"
                :format-options="{ style: 'currency', currency: 'USD' }"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Motivo"
              required
              help="Por ejemplo: pago de un gasto menor."
            >
              <UTextarea
                v-model="salidaMotivo"
                :rows="2"
                class="w-full"
              />
            </UFormField>
          </form>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="salidaTurno = null"
            />
            <UButton
              type="submit"
              form="form-salida"
              label="Registrar salida"
              :loading="registrandoSalida"
              :disabled="salidaMonto === undefined || !!errorSalida || salidaMotivo.trim().length < 3"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
