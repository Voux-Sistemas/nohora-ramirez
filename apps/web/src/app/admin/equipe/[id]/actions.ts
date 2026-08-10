'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { setStaffPassword } from '@/server/auth/password'
import {
  alcanceDoStaff,
  createStaff,
  replaceSchedule,
  updateStaff,
  type PapelEquipe,
  type ScheduleInput,
  type StaffInput,
} from '@/server/admin/staff'
import { assertGestao, podeRede, veUnidade, type Acesso } from '@/server/auth/permissoes'

/**
 * Cadastro de equipe.
 *
 * Nada disso conferia nada, e a ficha da equipe é a chave do sistema: dava para
 * criar profissional, mudar lotação e — pior — definir a senha de qualquer conta,
 * porque o `userId` vinha escondido no formulário. Agora quem manda é sempre a
 * pergunta ao banco: de quem é este perfil e em que lojas essa pessoa atende.
 */

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
const NEGADO = 'sem permissão para esta ação'

function parseStaff(formData: FormData): StaffInput {
  return {
    name: String(formData.get('name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim() || undefined,
    bio: String(formData.get('bio') ?? '').trim() || undefined,
    color: String(formData.get('color') ?? '#95663a'),
    acceptsOnlineBooking: formData.get('acceptsOnlineBooking') === 'on',
    active: formData.get('active') === 'on',
    unitIds: formData.getAll('unitIds').map(String),
    serviceIds: formData.getAll('serviceIds').map(String),
  }
}

export async function salvarProfissional(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const input = parseStaff(formData)
  if (!input.name || !input.phone) return

  const acesso = id === 'novo' ? await assertGestao() : (await autorizarStaff(id)).acesso

  /* Só a dona escolhe o degrau. Do gerente o campo nem chega — e se chegasse,
     seria ignorado: `papel` ausente quer dizer "não mexa no papel". */
  if (podeRede(acesso)) {
    const papel = String(formData.get('papel') ?? '')
    if (papel === 'gerente' || papel === 'profissional' || papel === 'dona') {
      input.papel = papel as PapelEquipe
    }

    /* Rebaixar a si mesma é sair do sistema pela porta que se está fechando: a
       tela seguinte já recusaria a entrada, e não haveria como voltar atrás.
       Passar o bastão é promover a outra pessoa primeiro, com as duas contas
       vivas, e só então descer. */
    if (input.papel && input.papel !== 'dona' && id !== 'novo') {
      const alvo = await alcanceDoStaff(id)
      if (alvo?.userId === acesso.session.userId) {
        throw new Error('você não pode tirar o próprio acesso de dona')
      }
    }
  }

  /* Marcar uma loja fora do alcance seria lotar alguém onde quem salva não
     manda — e, no caso do gerente, escrever o próprio acesso em outra unidade. */
  for (const unitId of input.unitIds) {
    if (!veUnidade(acesso, unitId)) throw new Error(NEGADO)
  }

  /* Sem lotação nenhuma, quem tem alcance recortado cria alguém que ela mesma
     não enxerga na lista no instante seguinte. A dona pode: cadastrar hoje e
     alocar depois é fluxo dela. */
  if (acesso.unidadeIds !== null && input.unitIds.length === 0) {
    throw new Error('marque ao menos uma unidade')
  }

  const escopo = acesso.unidadeIds
  const staffId = id === 'novo' ? await createStaff(input, escopo) : id
  if (id !== 'novo') await updateStaff(id, input, escopo)

  revalidatePath('/admin/equipe')
  redirect(`/admin/equipe/${staffId}` as never)
}

/** Uma linha por unidade+dia com um único turno — cobre a escala comum. */
function parseSchedule(formData: FormData): ScheduleInput[] {
  const rows: ScheduleInput[] = []
  for (const weekday of WEEKDAYS) {
    const unitId = String(formData.get(`sc${weekday}_unit`) ?? '').trim()
    const startsAt = String(formData.get(`sc${weekday}_start`) ?? '').trim()
    const endsAt = String(formData.get(`sc${weekday}_end`) ?? '').trim()
    if (unitId && startsAt && endsAt) rows.push({ unitId, weekday, startsAt, endsAt })
  }
  return rows
}

export async function salvarEscala(formData: FormData): Promise<void> {
  const staffId = String(formData.get('staffId') ?? '')
  if (!staffId) return
  const { acesso } = await autorizarStaff(staffId)

  const rows = parseSchedule(formData)
  for (const row of rows) {
    if (!veUnidade(acesso, row.unitId)) throw new Error(NEGADO)
  }

  const today = new Date().toISOString().slice(0, 10)
  await replaceSchedule(staffId, today, rows, acesso.unidadeIds)
  revalidatePath(`/admin/equipe/${staffId}`)
}

export interface PasswordState {
  error?: string
  success?: boolean
}

export async function salvarSenha(_state: PasswordState, formData: FormData): Promise<PasswordState> {
  const staffId = String(formData.get('staffId') ?? '')
  const senha = String(formData.get('senha') ?? '')
  const confirmar = String(formData.get('confirmar') ?? '')
  if (!staffId) return { error: 'Profissional inválido.' }
  if (senha.length < 8) return { error: 'A senha precisa ter pelo menos 8 caracteres.' }
  if (senha !== confirmar) return { error: 'As senhas não coincidem.' }

  /* A conta é a do perfil aberto, lida do banco. O formulário não escolhe de
     quem é a senha. */
  const { alvo } = await autorizarStaff(staffId)

  await setStaffPassword(alvo.userId, senha)
  revalidatePath(`/admin/equipe/${staffId}`)
  return { success: true }
}

/**
 * Quem edita precisa ser da gestão **e** ter a pessoa ao alcance: basta uma loja
 * em comum. Quem não tem lotação nenhuma é só da dona — é o caso de quem acabou
 * de ser cadastrado e ainda não foi alocado.
 */
async function autorizarStaff(
  staffId: string,
): Promise<{ acesso: Acesso; alvo: { userId: string; unitIds: string[] } }> {
  const acesso = await assertGestao()
  const alvo = await alcanceDoStaff(staffId)
  if (!alvo) throw new Error('profissional não encontrado')
  if (!alvo.unitIds.some((unitId) => veUnidade(acesso, unitId)) && acesso.unidadeIds !== null) {
    throw new Error(NEGADO)
  }
  return { acesso, alvo }
}
