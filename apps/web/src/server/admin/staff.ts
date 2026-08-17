import 'server-only'

/**
 * Cadastro de equipe: pessoa, unidades onde atende e escala semanal.
 *
 * `staff_schedules` nunca é editada linha a linha — trocar a escala fecha a
 * vigência antiga (`validTo`) e abre uma nova, para o passado da agenda não
 * mudar retroativamente. A antiga acaba ontem e a nova começa hoje: as duas
 * pontas encostam sem se sobrepor, e a mudança vale já no dia em que foi
 * feita. Qualquer visita já marcada continua igual.
 */

import { addDaysInZone } from '@studio/core'
import { staffProfiles, staffSchedules, staffSkills, staffUnits, units, userRoles, users } from '@studio/db'
import { and, asc, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toE164 } from '@/lib/format'

/**
 * Papel de acesso da pessoa, do jeito que a dona fala.
 *
 * `profissional` atende e vê a própria agenda; `gerente` toca a operação das
 * unidades marcadas no cadastro; `dona` enxerga a rede inteira e mexe no
 * catálogo. Vira linha em `user_roles` — e é de lá que os porteiros leem. Quem
 * nomeia gerente ou dona é só quem já é dona.
 *
 * `dona` existe aqui por um motivo prático: a conta do `/comecar` é criada por
 * quem instala o sistema, que nem sempre é a dona do salão. Sem este degrau no
 * formulário, a dona de verdade ficaria presa em gerente para sempre.
 */
export type PapelEquipe = 'profissional' | 'gerente' | 'dona'

export interface StaffListRow {
  id: string
  name: string
  phone: string
  color: string
  acceptsOnlineBooking: boolean
  active: boolean
  unitNames: string[]
  papel: PapelEquipe
}

/**
 * A equipe que quem pediu pode ver. `unidadeIds` nulo é a rede inteira; uma
 * lista recorta para quem atende nessas lojas — o gerente do Centro não abre a
 * ficha, o telefone nem a escala de quem só trabalha no Jardins.
 */
export async function listStaffAdmin(
  unidadeIds: readonly string[] | null = null,
): Promise<StaffListRow[]> {
  if (unidadeIds !== null && unidadeIds.length === 0) return []

  const rows = await db
    .select({
      id: staffProfiles.id,
      name: staffProfiles.displayName,
      phone: users.phone,
      color: staffProfiles.color,
      acceptsOnlineBooking: staffProfiles.acceptsOnlineBooking,
      active: staffProfiles.active,
      userId: staffProfiles.userId,
    })
    .from(staffProfiles)
    .innerJoin(users, eq(users.id, staffProfiles.userId))
    .orderBy(asc(staffProfiles.displayName))

  // nome da unidade é resolvido com um join à parte para não duplicar linhas de equipe
  const assignments = await db
    .select({ staffId: staffUnits.staffId, unitId: staffUnits.unitId, unitName: units.name })
    .from(staffUnits)
    .innerJoin(units, eq(units.id, staffUnits.unitId))

  const byStaff = new Map<string, { id: string; name: string }[]>()
  for (const row of assignments) {
    const list = byStaff.get(row.staffId) ?? []
    list.push({ id: row.unitId, name: row.unitName })
    byStaff.set(row.staffId, list)
  }

  const papeis = await papeisPorUsuario(rows.map((row) => row.userId))

  return rows
    .map((row) => {
      const lotacoes = byStaff.get(row.id) ?? []
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        color: row.color,
        acceptsOnlineBooking: row.acceptsOnlineBooking,
        active: row.active,
        /* A lista de lojas também é recortada: dizer "atende no Centro e no
           Jardins" para quem só responde pelo Centro já conta de mais. */
        unitNames: lotacoes
          .filter((item) => unidadeIds === null || unidadeIds.includes(item.id))
          .map((item) => item.name),
        papel: papeis.get(row.userId) ?? ('profissional' as const),
        unitIds: lotacoes.map((item) => item.id),
      }
    })
    .filter((row) =>
      unidadeIds === null ? true : row.unitIds.some((unitId) => unidadeIds.includes(unitId)),
    )
    .map(({ unitIds: _unitIds, ...row }) => row)
}

/**
 * O degrau de cada um destes usuários, lido de `user_roles`.
 *
 * `owner` vence `unit_manager` — quem acumula fica com o mais forte, a mesma
 * regra que `permissoes.ts` aplica na hora de montar a sessão. Quem não tem
 * nenhuma das duas linhas é profissional, que é o degrau base da equipe.
 */
async function papeisPorUsuario(userIds: readonly string[]): Promise<Map<string, PapelEquipe>> {
  const papeis = new Map<string, PapelEquipe>()
  if (userIds.length === 0) return papeis

  const rows = await db
    .select({ userId: userRoles.userId, role: userRoles.role })
    .from(userRoles)
    .where(
      and(
        inArray(userRoles.userId, [...userIds]),
        inArray(userRoles.role, ['owner', 'unit_manager']),
      ),
    )

  for (const row of rows) {
    if (row.role === 'owner') papeis.set(row.userId, 'dona')
    else if (papeis.get(row.userId) !== 'dona') papeis.set(row.userId, 'gerente')
  }
  return papeis
}

/**
 * Quem é a pessoa por trás do perfil e em que lojas ela atende.
 *
 * As ações de equipe recebem só o `staffId` do formulário. É por aqui que ele
 * vira "conta de quem", "loja de quem" e "degrau de quem", para o porteiro
 * perguntar ao banco em vez de acreditar num campo escondido — trocar o
 * `userId` do formulário era um jeito de trocar a senha de qualquer conta,
 * inclusive a da dona.
 *
 * O `papel` vem junto porque estar ao alcance não basta: numa rede de duas
 * lojas a dona também atende, então ela partilha unidade com o gerente dela, e
 * "temos uma loja em comum" sozinho deixava o gerente abrir a ficha da patroa.
 */
export async function alcanceDoStaff(
  id: string,
): Promise<{ userId: string; unitIds: string[]; papel: PapelEquipe } | null> {
  const [row] = await db
    .select({ userId: staffProfiles.userId })
    .from(staffProfiles)
    .where(eq(staffProfiles.id, id))
    .limit(1)
  if (!row) return null

  const lotacoes = await db
    .select({ unitId: staffUnits.unitId })
    .from(staffUnits)
    .where(eq(staffUnits.staffId, id))

  const papeis = await papeisPorUsuario([row.userId])

  return {
    userId: row.userId,
    unitIds: lotacoes.map((item) => item.unitId),
    papel: papeis.get(row.userId) ?? 'profissional',
  }
}

export interface StaffDetail {
  id: string
  userId: string
  name: string
  phone: string
  email: string | null
  bio: string | null
  color: string
  acceptsOnlineBooking: boolean
  active: boolean
  unitIds: string[]
  serviceIds: string[]
  papel: PapelEquipe
}

export interface ScheduleRow {
  id: string
  unitId: string
  weekday: number
  startsAt: string
  endsAt: string
}

export async function getStaffAdmin(
  id: string,
): Promise<{ staff: StaffDetail; schedule: ScheduleRow[] } | null> {
  const [row] = await db
    .select({
      id: staffProfiles.id,
      userId: staffProfiles.userId,
      name: staffProfiles.displayName,
      phone: users.phone,
      email: users.email,
      bio: staffProfiles.bio,
      color: staffProfiles.color,
      acceptsOnlineBooking: staffProfiles.acceptsOnlineBooking,
      active: staffProfiles.active,
    })
    .from(staffProfiles)
    .innerJoin(users, eq(users.id, staffProfiles.userId))
    .where(eq(staffProfiles.id, id))
    .limit(1)
  if (!row) return null

  const [units, skills, schedule, papeis] = await Promise.all([
    db.select({ unitId: staffUnits.unitId }).from(staffUnits).where(eq(staffUnits.staffId, id)),
    db.select({ serviceId: staffSkills.serviceId }).from(staffSkills).where(eq(staffSkills.staffId, id)),
    db
      .select()
      .from(staffSchedules)
      .where(and(eq(staffSchedules.staffId, id), isNull(staffSchedules.validTo)))
      .orderBy(asc(staffSchedules.weekday), asc(staffSchedules.startsAt)),
    papeisPorUsuario([row.userId]),
  ])

  return {
    staff: {
      ...row,
      unitIds: units.map((u) => u.unitId),
      serviceIds: skills.map((s) => s.serviceId),
      papel: papeis.get(row.userId) ?? 'profissional',
    },
    schedule: schedule.map((s) => ({
      id: s.id,
      unitId: s.unitId,
      weekday: s.weekday,
      startsAt: s.startsAt.slice(0, 5),
      endsAt: s.endsAt.slice(0, 5),
    })),
  }
}

export interface StaffInput {
  name: string
  phone: string
  email?: string
  bio?: string
  color: string
  acceptsOnlineBooking: boolean
  active: boolean
  unitIds: string[]
  serviceIds: string[]
  /**
   * Só a dona manda este campo. Ausente quer dizer "não mexa no papel" — é o
   * que o gerente salva ao editar a ficha de quem atende na loja dele.
   */
  papel?: PapelEquipe
}

/**
 * O recorte de quem está salvando. `null` é a rede.
 *
 * Existe por causa de uma armadilha concreta: o formulário do gerente só mostra
 * as lojas dele, e gravar substituindo a lotação inteira tiraria a profissional
 * das outras unidades sem ninguém perceber. Com escopo, a gravação troca apenas
 * as lotações de dentro do alcance e deixa as de fora como estavam.
 */
export type EscopoEquipe = readonly string[] | null

/** Papéis que não são poder nenhum — qualquer outro é degrau acima. */
const SEM_PODER: ('client' | 'professional')[] = ['client', 'professional']

export async function createStaff(
  input: StaffInput,
  escopo: EscopoEquipe = null,
  /** Quem manda na rede pode pôr na equipa uma conta que já tem poder. */
  mandaNaRede = false,
): Promise<string> {
  const phone = toE164(input.phone)
  if (!phone) throw new Error('telefone inválido')

  return db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1)

    /* Uma pessoa, um perfil de equipa: `staff_profiles.user_id` é único.
       Sem esta pergunta, cadastrar alguém com o telefone de quem já atende
       batia na unique e devolvia o SQL cru à dona — foi o que aconteceu ao
       tentar criar a ficha com o número do Kauan, que já estava na equipa.
       O telefone é a chave da pessoa em todo o sistema (é por ele que se
       entra), portanto repetido quer dizer mesma pessoa, e mesma pessoa
       quer dizer ficha que já existe. */
    if (existingUser) {
      const [jaNaEquipa] = await tx
        .select({ id: staffProfiles.id, nome: staffProfiles.displayName })
        .from(staffProfiles)
        .where(eq(staffProfiles.userId, existingUser.id))
        .limit(1)
      if (jaNaEquipa) {
        throw new Error(
          `este telefone já é de ${jaNaEquipa.nome}, que está na equipa — abra a ficha dessa pessoa em vez de criar outra`,
        )
      }

      /* Ficha de equipa e poder são coisas separadas: quem manda está em
         `user_roles`, e a conta da dona nasce em `criarPrimeiraConta` com papel
         de `owner` e sem ficha de equipa nenhuma — foi assim que a produção
         subiu. Perguntar só a `staff_profiles` deixava a conta mais poderosa da
         casa passar por aqui: bastava uma gerente escrever o telemóvel da dona
         num cadastro novo e deixar a caixa «Ativo» por marcar. A ficha
         desactivada colava-se à conta dela, `acessoDe` passa a tratar isso como
         porta fechada em todos os degraus, e o salão ficava sem dona até
         alguém abrir o Postgres à mão — a recuperação por e-mail não salva,
         porque a sessão nasce e é logo recusada. É a mesma regra de
         `autorizarStaff`, do lado de cá da porta. */
      const [comPoder] = await tx
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(and(eq(userRoles.userId, existingUser.id), notInArray(userRoles.role, SEM_PODER)))
        .limit(1)
      if (comPoder && !mandaNaRede) {
        throw new Error(
          'este telefone é de uma conta com acesso de gestão — quem põe essa pessoa na equipa é a administração da rede',
        )
      }
    }

    const userId =
      existingUser?.id ??
      (
        await tx
          .insert(users)
          .values({ phone, name: input.name, email: input.email || null })
          .returning({ id: users.id })
      )[0]!.id

    const [profile] = await tx
      .insert(staffProfiles)
      .values({
        userId,
        displayName: input.name,
        bio: input.bio || null,
        color: input.color,
        acceptsOnlineBooking: input.acceptsOnlineBooking,
        active: input.active,
      })
      .returning({ id: staffProfiles.id })
    const staffId = profile!.id

    /* Todo mundo da equipe entra como profissional: é o papel que dá a agenda
       própria. Gerente é um degrau A MAIS, não um degrau no lugar deste. */
    await tx.insert(userRoles).values({ userId, role: 'professional' }).onConflictDoNothing()
    await writeUnitsAndSkills(tx, staffId, input, escopo)
    await syncPapel(tx, userId, input.papel, input.unitIds)
    return staffId
  })
}

export async function updateStaff(
  id: string,
  input: StaffInput,
  escopo: EscopoEquipe = null,
): Promise<void> {
  const phone = toE164(input.phone)
  if (!phone) throw new Error('telefone inválido')

  await db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ userId: staffProfiles.userId })
      .from(staffProfiles)
      .where(eq(staffProfiles.id, id))
      .limit(1)
    if (!profile) throw new Error('profissional não encontrado')

    /* O mesmo pela outra ponta: `users.phone` também é único. Corrigir o
       número para um que já é de outra pessoa é engano de digitação com uma
       consequência séria — as duas contas passariam a disputar a mesma porta
       de entrada —, e sem esta pergunta a recusa chegava como SQL. */
    const [donoDoNumero] = await tx
      .select({ id: users.id, nome: users.name })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1)
    if (donoDoNumero && donoDoNumero.id !== profile.userId) {
      throw new Error(
        `este telefone já está registado em ${donoDoNumero.nome} — dois registos não podem partilhar o mesmo número`,
      )
    }

    await tx
      .update(users)
      .set({ name: input.name, phone, email: input.email || null })
      .where(eq(users.id, profile.userId))

    await tx
      .update(staffProfiles)
      .set({
        displayName: input.name,
        bio: input.bio || null,
        color: input.color,
        acceptsOnlineBooking: input.acceptsOnlineBooking,
        active: input.active,
      })
      .where(eq(staffProfiles.id, id))

    await writeUnitsAndSkills(tx, id, input, escopo)
    await syncPapel(tx, profile.userId, input.papel, input.unitIds)
  })
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function writeUnitsAndSkills(
  tx: Tx,
  staffId: string,
  input: StaffInput,
  escopo: EscopoEquipe,
): Promise<void> {
  const dentro = (unitId: string) => escopo === null || escopo.includes(unitId)

  const atuais = await tx
    .select({ unitId: staffUnits.unitId })
    .from(staffUnits)
    .where(eq(staffUnits.staffId, staffId))

  /* De fora do escopo, fica o que já estava; de dentro, vale o formulário. */
  const preservadas = atuais.map((row) => row.unitId).filter((unitId) => !dentro(unitId))
  const novas = input.unitIds.filter(dentro)
  const finais = [...new Set([...preservadas, ...novas])]

  await tx.delete(staffUnits).where(eq(staffUnits.staffId, staffId))
  if (finais.length > 0) {
    await tx.insert(staffUnits).values(
      finais.map((unitId, index) => ({ staffId, unitId, isPrimary: index === 0 })),
    )
  }

  /* Habilidade é do par de mãos, não da loja: não tem dimensão de unidade para
     recortar, e quem cuida da equipe decide o que ela faz. */
  await tx.delete(staffSkills).where(eq(staffSkills.staffId, staffId))
  if (input.serviceIds.length > 0) {
    await tx.insert(staffSkills).values(input.serviceIds.map((serviceId) => ({ staffId, serviceId })))
  }
}

/**
 * Escreve o degrau de acesso em `user_roles`.
 *
 * Uma linha de `unit_manager` por unidade — é assim que `permissoes.ts` lê o
 * alcance do gerente. `owner` é uma linha só, sem unidade, que é como a dona
 * enxerga a rede inteira.
 *
 * A única regra rígida aqui: o sistema nunca fica sem nenhuma dona. Tirar a
 * última é o mesmo que jogar a chave fora — ninguém mais poderia cadastrar
 * unidade, serviço ou promover alguém, e não há tela para consertar isso por
 * dentro. Quem tenta leva um erro, não um sucesso silencioso.
 */
async function syncPapel(
  tx: Tx,
  userId: string,
  papel: PapelEquipe | undefined,
  unitIds: readonly string[],
): Promise<void> {
  if (!papel) return

  if (papel !== 'dona' && (await ehUltimaDona(tx, userId))) {
    throw new Error('esta é a única dona do sistema — promova outra pessoa antes de rebaixar esta')
  }

  await tx
    .delete(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        inArray(userRoles.role, ['unit_manager', 'owner']),
      ),
    )

  if (papel === 'dona') {
    /* Sem `unitId`: escopo de rede. É o que `escopoDe` lê como "enxerga tudo". */
    await tx.insert(userRoles).values({ userId, role: 'owner' }).onConflictDoNothing()
    return
  }

  if (papel !== 'gerente' || unitIds.length === 0) return
  await tx
    .insert(userRoles)
    .values(unitIds.map((unitId) => ({ userId, role: 'unit_manager' as const, unitId })))
    .onConflictDoNothing()
}

/** Esta pessoa é dona e não sobrou nenhuma outra. */
async function ehUltimaDona(tx: Tx, userId: string): Promise<boolean> {
  const donas = await tx
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, 'owner'))

  const ids = new Set(donas.map((row) => row.userId))
  return ids.has(userId) && ids.size === 1
}

export interface ScheduleInput {
  unitId: string
  weekday: number
  startsAt: string
  endsAt: string
}

/**
 * Substitui a escala vigente por uma nova, a partir de hoje. Escalas antigas
 * (`validTo` preenchido) ficam intactas — é o histórico que explica quem
 * trabalhava quando.
 *
 * O `escopo` protege o mesmo ponto que a lotação: o gerente do Centro salvando a
 * escala de quem também atende no Jardins não pode fechar a terça-feira de lá,
 * que ele nem enxerga no formulário.
 */
export async function replaceSchedule(
  staffId: string,
  today: string,
  rows: readonly ScheduleInput[],
  escopo: EscopoEquipe = null,
): Promise<void> {
  if (escopo !== null && escopo.length === 0) return

  /*
    A escala antiga acaba **ontem**, não hoje.

    `validTo` é inclusivo do lado de quem lê: `context.ts` só descarta a linha
    quando `validTo < date`. Fechando a antiga com `validTo = hoje` e abrindo a
    nova com `validFrom = hoje`, as duas valiam hoje ao mesmo tempo, e o leitor
    soma os dois turnos em vez de escolher um. Na prática: a dona encurtava o
    sábado das 18h para as 13h, guardava, via a escala nova na ficha — e
    `/agendar` continuava a vender as 15h30 até ao dia seguinte. Apagar o dia
    inteiro dava no mesmo: hoje continuava aberto. Ninguém liga uma coisa à
    outra quando a cliente aparece.

    A linha antiga continua no banco, com o histórico intacto — só deixa de
    valer no dia em que foi substituída, que é o que "substituir" quer dizer.
    Editar duas vezes no mesmo dia deixa a primeira com `validTo` anterior ao
    `validFrom`: linha morta, nunca escolhida pelo leitor por nenhum dos dois
    lados, e é esse o resultado certo.
  */
  const ontem = addDaysInZone(today, -1)

  await db.transaction(async (tx) => {
    await tx
      .update(staffSchedules)
      .set({ validTo: ontem })
      .where(
        and(
          eq(staffSchedules.staffId, staffId),
          isNull(staffSchedules.validTo),
          escopo === null ? undefined : inArray(staffSchedules.unitId, [...escopo]),
        ),
      )

    if (rows.length === 0) return
    await tx.insert(staffSchedules).values(
      rows.map((row) => ({
        staffId,
        unitId: row.unitId,
        weekday: row.weekday,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        validFrom: today,
      })),
    )
  })
}
