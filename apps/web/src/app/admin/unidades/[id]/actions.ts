'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  addUnitException,
  createUnit,
  getUnitImage,
  removeUnitException,
  replaceUnitHours,
  setUnitImage,
  updateUnit,
  type HoursInput,
  type UnitInput,
} from '@/server/admin/units'
import { assertRede } from '@/server/auth/permissoes'
import { resolveImageField } from '@/server/storage/form'

/*
  Unidade é da rede: nome, endereço, horário de funcionamento e as regras que a
  agenda da loja inteira obedece. Só a dona. As três ações conferem por conta
  própria porque nenhuma tela protege um endereço HTTP.
*/

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

function parseUnit(formData: FormData): UnitInput {
  return {
    name: String(formData.get('name') ?? '').trim(),
    slug: String(formData.get('slug') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim() || undefined,
    email: String(formData.get('email') ?? '').trim() || undefined,
    addressLine: String(formData.get('addressLine') ?? '').trim() || undefined,
    district: String(formData.get('district') ?? '').trim() || undefined,
    city: String(formData.get('city') ?? '').trim() || undefined,
    state: String(formData.get('state') ?? '').trim() || undefined,
    postalCode: String(formData.get('postalCode') ?? '').trim() || undefined,
    timezone: String(formData.get('timezone') ?? '').trim() || 'America/Sao_Paulo',
    active: formData.get('active') === 'on',
    settings: {
      minLeadMin: Number(formData.get('minLeadMin') ?? 120),
      maxLeadDays: Number(formData.get('maxLeadDays') ?? 60),
      granularityMin: Number(formData.get('granularityMin') ?? 15),
      cancellationWindowHours: Number(formData.get('cancellationWindowHours') ?? 24),
      interServiceGapMin: Number(formData.get('interServiceGapMin') ?? 0),
    },
  }
}

/** Até 2 turnos por dia (manhã/tarde) — cobre o caso comum do intervalo de almoço. */
function parseHours(formData: FormData): HoursInput[] {
  const rows: HoursInput[] = []
  for (const weekday of WEEKDAYS) {
    for (const slot of [1, 2] as const) {
      const opensAt = String(formData.get(`h${weekday}_${slot}_start`) ?? '').trim()
      const closesAt = String(formData.get(`h${weekday}_${slot}_end`) ?? '').trim()
      if (opensAt && closesAt) rows.push({ weekday, opensAt, closesAt })
    }
  }
  return rows
}

export async function salvarUnidade(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const input = parseUnit(formData)
  const hours = parseHours(formData)
  if (!input.name || !input.slug) return
  await assertRede()

  const unitId = id === 'nova' ? await createUnit(input) : id
  if (id !== 'nova') await updateUnit(id, input)
  await replaceUnitHours(unitId, hours)

  // depois do insert: a chave do arquivo é montada com o id da unidade, que
  // numa unidade nova só existe agora
  const previous = id === 'nova' ? null : await getUnitImage(unitId)
  const imageUrl = await resolveImageField(formData, 'imagem', 'unidades', unitId, previous)
  if (imageUrl !== undefined) await setUnitImage(unitId, imageUrl)

  revalidatePath('/admin/unidades')
  // a foto aparece na escolha de unidade da cliente, que é estática por padrão
  revalidatePath('/agendar')
  redirect(`/admin/unidades/${unitId}` as never)
}

export async function adicionarExcecao(formData: FormData): Promise<void> {
  const unitId = String(formData.get('unitId') ?? '')
  const date = String(formData.get('date') ?? '')
  const closed = formData.get('closed') === 'on'
  if (!unitId || !date) return
  await assertRede()

  await addUnitException(unitId, {
    date,
    closed,
    opensAt: closed ? undefined : String(formData.get('opensAt') ?? '').trim() || undefined,
    closesAt: closed ? undefined : String(formData.get('closesAt') ?? '').trim() || undefined,
    reason: String(formData.get('reason') ?? '').trim() || undefined,
  })
  revalidatePath(`/admin/unidades/${unitId}`)
}

export async function removerExcecao(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const unitId = String(formData.get('unitId') ?? '')
  if (!id) return
  await assertRede()
  await removeUnitException(id)
  revalidatePath(`/admin/unidades/${unitId}`)
}
