/**
 * Dados de demonstração por cima do catálogo verdadeiro.
 *
 *   npm run db:demo             — escreve
 *   npm run db:demo -- --limpar — apaga exactamente o que escreveu
 *
 * Para que serve: o salão tem os 67 serviços, as duas lojas, as fotografias e a
 * equipa cadastrados, e nenhum movimento. Sem movimento não há como julgar o
 * produto — a agenda está vazia, o caixa nunca abriu e a faturação do mês é
 * zero. Isto enche essas telas com uma operação plausível de sete semanas.
 *
 * O que NÃO faz, e porquê:
 *
 *   · Não toca no `db:seed`. Esse trunca o schema inteiro antes de semear —
 *     levava os 67 serviços, as 7 fotografias e as 138 habilidades que custaram
 *     trabalho a montar. Aqui só se INSERE.
 *   · Não inventa profissionais. Uma profissional de mentira apareceria no
 *     agendamento público, onde uma cliente real a podia escolher. As marcações
 *     são todas com a equipa que existe.
 *   · Não inventa serviços nem preços. O catálogo é o do salão, tal como está.
 *
 * A agenda não é preenchida à força: cada visita é planeada pelo mesmo motor de
 * disponibilidade que o site usa (`findAvailableSlots`), com o horário real das
 * lojas e a escala real da equipa. Se este script produzisse sobreposição, a
 * constraint de exclusão do Postgres derrubava-o na hora — é de propósito.
 *
 * Tudo o que nasce aqui fica registado em `demo_linhas` na mesma transacção
 * (ver `registo.ts`), e é essa lista — e não uma heurística de nome ou de data —
 * que o `--limpar` usa. Ou entra tudo, ou não entra nada.
 */

import '../env'
import { randomUUID } from 'node:crypto'
import {
  addDaysInZone,
  isoDateInZone,
  zonedDateTime,
  type PriceOverride,
  type TimeRange,
} from '@studio/core'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { urlDireta } from '../index'
import {
  appointmentDiscounts,
  appointmentItems,
  appointmentResourceBlocks,
  appointments,
  appointmentStaffBlocks,
  appointmentStatusEvents,
  cashMovements,
  cashSessions,
  clientNotes,
  clientProfiles,
  comandaClosures,
  organizations,
  payments,
  resources,
  serviceResourceRequirements,
  servicePricing,
  services,
  staffProfiles,
  staffSchedules,
  staffSkills,
  staffUnits,
  toRange,
  unitHours,
  units,
  userRoles,
  users,
  schema,
} from '../index'
import {
  generateAppointments,
  type ClientCtx,
  type ResourceCtx,
  type ServiceCtx,
  type StaffCtx,
  type UnitCtx,
} from '../seed/appointments'
import { Rng } from '../seed/rng'
import { CLIENTES, emailDemo, PREFIXO_TELEFONE_DEMO, telefoneDemo } from './pessoas'
import {
  agruparRegisto,
  apagarPeloRegisto,
  contarRegisto,
  criarTabelaDeRegisto,
  existeRegisto,
  gravarRegisto,
  largarTabelaDeRegisto,
  Registo,
} from './registo'

/**
 * Sete semanas para trás, dez dias para a frente.
 *
 * As duas semanas que interessam ver na agenda são as do meio. O resto do
 * passado existe por causa do painel: a faturação do mês compara-se com o mesmo
 * trecho do mês anterior, e sem nada em julho o número grande da primeira tela
 * nasce com "primeiro mês com movimento" e sem seta de variação — que é
 * justamente a leitura que se quer demonstrar.
 *
 * O futuro é curto de propósito. Marcação futura ocupa horário a sério: o site
 * está no ar, e cada visita gerada é um horário que deixa de aparecer a quem
 * entrar em /agendar. Dez dias chegam para a agenda ter o que mostrar sem fechar
 * o mês a uma cliente de verdade.
 */
const DIAS_ATRAS = 48
const DIAS_ADIANTE = 10

/**
 * O estúdio fictício do seed tem equipa larga e seis tentativas por pessoa
 * chegam. Aqui há uma profissional por loja para dez horas de expediente: com
 * seis, a agenda nascia com três marcações por dia e parecia um salão a fechar.
 */
const TENTATIVAS_POR_PROFISSIONAL = 14

/** Troco com que a gaveta abre de manhã. */
const ABERTURA_DE_CAIXA = 5_000

/** Um serviço curto e barato é o que sai junto de outro; um segundo trabalho de
    três horas na mesma visita não acontece. */
const TETO_DE_ACRESCENTO_MIN = 40
const TETO_DE_ACRESCENTO_CENTIMOS = 3_000

type Db = ReturnType<typeof drizzle<typeof schema>>

async function main(): Promise<void> {
  const limpar = process.argv.slice(2).includes('--limpar')

  /*
    Este script liga-se como DONO, e não pelo `DATABASE_URL` do site.

    O papel `app_web` só faz DML, por decisão do ADR-009 — não pode criar tabela
    nenhuma, e a tabela de registo é a peça que torna isto reversível. É a mesma
    ligação que a migration e as constraints já usam; a diferença é estar dita.
  */
  const url = urlDireta()
  const cliente = postgres(url, { max: 1 })
  const db = drizzle(cliente, { schema })

  console.log(`→ ${limpar ? 'a limpar' : 'a semear'} a demonstração em ${anfitriao(url)}`)

  try {
    if (limpar) await limparDemonstracao(db)
    else await semearDemonstracao(db)
  } finally {
    await cliente.end()
  }
}

function anfitriao(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'servidor desconhecido'
  }
}

// ─── a borracha ─────────────────────────────────────────────────────────────

async function limparDemonstracao(db: Db): Promise<void> {
  if (!(await existeRegisto(db))) {
    console.log('  não há registo de demonstração nesta base — nada a apagar')
    return
  }

  const grupos = await agruparRegisto(db)
  if (grupos.length === 0) {
    console.log('  o registo está vazio; largo a tabela e fico por aqui')
    await largarTabelaDeRegisto(db)
    return
  }

  console.log(`  registo com ${grupos.reduce((n, g) => n + g.linhas, 0)} linhas`)

  /* Tudo numa transacção: uma limpeza que morre a meio deixaria a base num
     estado que nem é a demonstração nem o salão limpo. */
  await db.transaction(async (tx) => {
    for (const { tabela, apagadas } of await apagarPeloRegisto(tx, grupos)) {
      console.log(`  − ${String(apagadas).padStart(5)} ${tabela}`)
    }
    await largarTabelaDeRegisto(tx)
  })

  console.log('✓ demonstração apagada; o catálogo do salão ficou como estava')
}

// ─── a caneta ───────────────────────────────────────────────────────────────

async function semearDemonstracao(db: Db): Promise<void> {
  if (await existeRegisto(db)) {
    const total = await contarRegisto(db)
    throw new Error(
      `já há uma demonstração nesta base (${total} linhas registadas).\n` +
        'Corra `npm run db:demo -- --limpar` antes de semear outra.',
    )
  }

  const rng = new Rng()
  const agora = new Date()

  // ─── o que o salão já tem ─────────────────────────────────────────────────

  const [org] = await db.select().from(organizations).limit(1)
  if (!org) throw new Error('não há organização nesta base — corra as migrations e o cadastro')
  const tz = org.timezone
  const hoje = isoDateInZone(agora, tz)
  const primeiroDia = addDaysInZone(hoje, -DIAS_ATRAS)

  const [lojas, horarios, catalogo, requisitos, precos, equipa, lojasDaEquipa, habilidades, escalas, recursosDaCasa] =
    await Promise.all([
      db.select().from(units).where(eq(units.active, true)),
      db.select().from(unitHours),
      db.select().from(services).where(eq(services.active, true)),
      db.select().from(serviceResourceRequirements),
      db.select().from(servicePricing),
      db.select().from(staffProfiles).where(eq(staffProfiles.active, true)),
      db.select().from(staffUnits),
      db.select().from(staffSkills).where(eq(staffSkills.enabled, true)),
      db.select().from(staffSchedules),
      db.select().from(resources).where(eq(resources.active, true)),
    ])

  if (lojas.length === 0) throw new Error('nenhuma loja activa')
  if (catalogo.length === 0) throw new Error('catálogo de serviços vazio')

  const idDaLoja = new Map(lojas.map((loja) => [loja.slug, loja.id]))
  const slugDaLoja = new Map(lojas.map((loja) => [loja.id, loja.slug]))

  const contextoDasLojas: UnitCtx[] = lojas.map((loja) => ({
    id: loja.id,
    slug: loja.slug,
    timezone: loja.timezone,
    hours: horarios
      .filter((h) => h.unitId === loja.id)
      .map((h) => [h.weekday, h.opensAt, h.closesAt] as const),
    granularityMin: Number((loja.settings as Record<string, unknown>)?.granularityMin ?? 15),
  }))

  /* O `slug` do gerador é só uma chave estável para casar serviço com
     habilidade. O catálogo real não tem coluna `slug`, portanto o id faz o
     papel — e o mapa de combos abaixo é construído com as mesmas chaves. */
  const contextoDosServicos: ServiceCtx[] = catalogo.map((servico) => ({
    id: servico.id,
    slug: servico.id,
    basePrice: servico.basePrice,
    baseDurationMin: servico.setupMin + servico.processingMin + servico.finishMin,
    onlineBookable: servico.onlineBookable,
    deposit:
      servico.requiresDeposit && servico.depositType && servico.depositValue
        ? servico.depositType === 'percent'
          ? { type: 'percent', bps: servico.depositValue }
          : { type: 'fixed', cents: servico.depositValue }
        : null,
    spec: {
      serviceId: servico.id,
      duration: {
        setupMin: servico.setupMin,
        processingMin: servico.processingMin,
        finishMin: servico.finishMin,
        bufferBeforeMin: servico.bufferBeforeMin,
        bufferAfterMin: servico.bufferAfterMin,
      },
      requiredResourceTypeIds: requisitos
        .filter((r) => r.serviceId === servico.id)
        .map((r) => r.resourceTypeId),
    },
  }))

  const contextoDaEquipa: StaffCtx[] = equipa.map((pessoa) => {
    const escala: Record<string, (readonly [number, string, string])[]> = {}
    for (const turno of escalas.filter((e) => e.staffId === pessoa.id)) {
      const slug = slugDaLoja.get(turno.unitId)
      if (!slug) continue
      ;(escala[slug] ??= []).push([turno.weekday, turno.startsAt, turno.endsAt] as const)
    }
    return {
      id: pessoa.id,
      slug: pessoa.id,
      units: lojasDaEquipa
        .filter((l) => l.staffId === pessoa.id)
        .map((l) => slugDaLoja.get(l.unitId))
        .filter((slug): slug is string => slug !== undefined),
      skills: habilidades.filter((h) => h.staffId === pessoa.id).map((h) => h.serviceId),
      acceptsOnlineBooking: pessoa.acceptsOnlineBooking,
      schedule: escala,
    }
  })

  const trabalhaMesmo = contextoDaEquipa.filter(
    (pessoa) => Object.keys(pessoa.schedule).length > 0 && pessoa.skills.length > 0,
  )
  if (trabalhaMesmo.length === 0) {
    throw new Error('nenhuma profissional com escala e habilidades — cadastre a equipa primeiro')
  }
  console.log(
    `  equipa com escala: ${trabalhaMesmo.length} de ${equipa.length}` +
      ` · lojas: ${lojas.length} · serviços: ${catalogo.length}`,
  )

  const recursosPorLoja = new Map<string, ResourceCtx[]>(
    lojas.map((loja) => [
      loja.slug,
      recursosDaCasa
        .filter((r) => r.unitId === loja.id)
        .map((r) => ({ id: r.id, resourceTypeId: r.resourceTypeId })),
    ]),
  )

  const excepcoesDePreco: PriceOverride[] = precos.map((p) => ({
    serviceId: p.serviceId,
    unitId: p.unitId,
    staffId: p.staffId,
    price: p.price,
    durationOverrideMin: p.durationOverrideMin,
  }))

  // ─── o que a agenda já tem ────────────────────────────────────────────────

  /* As marcações que já lá estão ocupam horário a sério, e o gerador não as vê.
     Sem isto ele proporia por cima delas e a constraint de exclusão derrubava a
     transacção inteira — correcto, mas inútil. Entram como ocupação de partida.

     As datas vão em ISO: num `sql` cru o driver não sabe serializar um `Date` e
     rebenta com «must be of type string» na hora de ligar os parâmetros. */
  const ocupado = await db.execute<{ staff_id: string; inicio: Date; fim: Date }>(sql`
    select b.staff_id, lower(b.block) as inicio, upper(b.block) as fim
      from appointment_staff_blocks b
     where upper(b.block) > ${zonedDateTime(primeiroDia, '00:00', tz).toISOString()}
       and lower(b.block) < ${zonedDateTime(
         addDaysInZone(hoje, DIAS_ADIANTE + 1),
         '00:00',
         tz,
       ).toISOString()}
  `)
  const ocupacaoDePartida = new Map<string, TimeRange[]>()
  for (const linha of ocupado) {
    const lista = ocupacaoDePartida.get(linha.staff_id) ?? []
    lista.push({ start: new Date(linha.inicio), end: new Date(linha.fim) })
    ocupacaoDePartida.set(linha.staff_id, lista)
  }
  const jaOcupadas = [...ocupacaoDePartida.values()].reduce((n, l) => n + l.length, 0)
  if (jaOcupadas > 0) console.log(`  a agenda já tem ${jaOcupadas} bloqueios; vou desviar deles`)

  // ─── as clientes ──────────────────────────────────────────────────────────

  /* O bloco de telefones tem de estar livre. Sem esta pergunta, uma colisão só
     se dá a ver lá à frente, como violação de chave única no meio da escrita —
     que é seguro, porque a transacção cai inteira, mas não explica nada a quem
     está a ler o erro. Já aconteceu: as contas provisórias da equipa ocupavam o
     bloco que este ficheiro escolhera. */
  const ocupados = await db.execute<{ phone: string }>(sql`
    select phone from users where phone like ${`${PREFIXO_TELEFONE_DEMO}%`} order by phone
  `)
  const colisoes = [...ocupados].map((linha) => linha.phone)
  if (colisoes.length > 0) {
    throw new Error(
      `o bloco de telefones da demonstração (${PREFIXO_TELEFONE_DEMO}…) já está ocupado: ` +
        `${colisoes.join(', ')}.\nEscolha outro prefixo em src/demo/pessoas.ts.`,
    )
  }

  const registo = new Registo()

  const linhasDeUtilizador: (typeof users.$inferInsert)[] = []
  const linhasDePerfil: (typeof clientProfiles.$inferInsert)[] = []
  const linhasDePapel: (typeof userRoles.$inferInsert)[] = []
  const linhasDeObservacao: (typeof clientNotes.$inferInsert)[] = []
  const contextoDasClientes: ClientCtx[] = []

  for (const [indice, cliente] of CLIENTES.entries()) {
    const userId = randomUUID()
    const perfilId = randomUUID()

    linhasDeUtilizador.push({
      id: userId,
      phone: telefoneDemo(indice),
      email: emailDemo(cliente.nome),
      name: cliente.nome,
    })
    linhasDePerfil.push({
      id: perfilId,
      userId,
      birthdate: cliente.aniversario,
      preferredUnitId: cliente.loja ? (idDaLoja.get(cliente.loja) ?? null) : null,
      tags: [...(cliente.etiquetas ?? [])],
      howFoundUs: cliente.comoConheceu ?? null,
    })
    linhasDePapel.push({ id: randomUUID(), userId, unitId: null, role: 'client' })
    if (cliente.nota) {
      linhasDeObservacao.push({
        id: randomUUID(),
        clientId: perfilId,
        body: cliente.nota,
        pinned: true,
      })
    }

    contextoDasClientes.push({
      id: perfilId,
      userId,
      ...(cliente.loja ? { preferredUnit: cliente.loja } : {}),
    })
  }

  /* Só `users` vai ao registo: perfil, papel e observação caem por `cascade` a
     partir dele. O que precisa de linha própria é o que tem `restrict` pelo
     caminho — as marcações e os pagamentos, mais abaixo. */
  registo.registar('users', linhasDeUtilizador.map((linha) => linha.id!))

  // ─── a agenda ─────────────────────────────────────────────────────────────

  const planeadas = generateAppointments({
    rng,
    units: contextoDasLojas,
    services: contextoDosServicos,
    staff: trabalhaMesmo,
    resourcesByUnit: recursosPorLoja,
    clients: contextoDasClientes,
    priceOverrides: excepcoesDePreco,
    fromDate: primeiroDia,
    days: DIAS_ATRAS + DIAS_ADIANTE + 1,
    today: hoje,
    now: agora,
    attemptsPerStaff: TENTATIVAS_POR_PROFISSIONAL,
    combos: combosDoCatalogo(catalogo),
    preexistingBusy: ocupacaoDePartida,
  })

  const specPorServico = new Map(contextoDosServicos.map((s) => [s.id, s]))
  const linhasDeMarcacao: (typeof appointments.$inferInsert)[] = []
  const linhasDeItem: (typeof appointmentItems.$inferInsert)[] = []
  const linhasDeBloqueio: (typeof appointmentStaffBlocks.$inferInsert)[] = []
  const linhasDeRecurso: (typeof appointmentResourceBlocks.$inferInsert)[] = []
  const linhasDeEvento: (typeof appointmentStatusEvents.$inferInsert)[] = []

  /** As comandas por fechar, agrupadas para a passagem do dinheiro logo abaixo. */
  interface ComandaPorFechar {
    id: string
    unitId: string
    fim: Date
    total: number
    itens: { id: string; serviceId: string; staffId: string; price: number }[]
  }
  const comandas: ComandaPorFechar[] = []

  const ultimaVisita = new Map<string, Date>()
  const primeiraVisita = new Map<string, Date>()
  const faltasPorCliente = new Map<string, number>()

  for (const visita of planeadas) {
    const cancelada = !visita.reservesTime
    const marcacaoId = randomUUID()

    linhasDeMarcacao.push({
      id: marcacaoId,
      unitId: visita.unitId,
      clientId: visita.clientId,
      startsAt: visita.slot.start,
      endsAt: visita.slot.end,
      status: visita.status,
      source: visita.source,
      clientNote: visita.clientNote ?? null,
      totalPrice: visita.totalPrice,
      depositRequired: visita.depositRequired,
      depositPaidAt: visita.depositRequired > 0 && !cancelada ? visita.slot.start : null,
      checkedInAt: jaChegou(visita.status) ? visita.slot.start : null,
      startedAt: jaComecou(visita.status) ? visita.slot.start : null,
      completedAt: visita.status === 'completed' ? visita.slot.end : null,
      cancelledAt: cancelada ? new Date(visita.slot.start.getTime() - 7_200_000) : null,
      cancellationReason: visita.cancellationReason ?? null,
    })

    linhasDeEvento.push({
      id: randomUUID(),
      appointmentId: marcacaoId,
      fromStatus: null,
      toStatus: visita.status,
      reason: visita.cancellationReason ?? null,
      occurredAt: visita.slot.start,
    })

    const itens: ComandaPorFechar['itens'] = []

    for (const [indice, item] of visita.slot.items.entries()) {
      const preco = visita.itemPrices[indice]!
      const spec = specPorServico.get(item.serviceId)!
      const itemId = randomUUID()

      linhasDeItem.push({
        id: itemId,
        appointmentId: marcacaoId,
        serviceId: item.serviceId,
        staffId: item.staffId,
        startsAt: item.start,
        endsAt: item.end,
        price: preco.price,
        durationMin: preco.durationMin,
        durationProfile: {
          setupMin: spec.spec.duration.setupMin,
          processingMin: spec.spec.duration.processingMin,
          finishMin: spec.spec.duration.finishMin,
        },
        sortOrder: indice,
      })
      itens.push({ id: itemId, serviceId: item.serviceId, staffId: item.staffId, price: preco.price })

      if (cancelada) continue

      for (const bloco of item.staffBusy) {
        linhasDeBloqueio.push({
          id: randomUUID(),
          appointmentItemId: itemId,
          staffId: item.staffId,
          block: toRange(bloco.start, bloco.end),
        })
      }
      for (const recursoId of item.resourceIds) {
        linhasDeRecurso.push({
          id: randomUUID(),
          appointmentItemId: itemId,
          resourceId: recursoId,
          block: toRange(item.resourceBusy.start, item.resourceBusy.end),
        })
      }
    }

    if (visita.status === 'no_show') {
      faltasPorCliente.set(visita.clientId, (faltasPorCliente.get(visita.clientId) ?? 0) + 1)
    }

    if (visita.status === 'completed') {
      comandas.push({
        id: marcacaoId,
        unitId: visita.unitId,
        fim: visita.slot.end,
        total: visita.totalPrice,
        itens,
      })
      const anteriorUltima = ultimaVisita.get(visita.clientId)
      if (!anteriorUltima || anteriorUltima < visita.slot.start) {
        ultimaVisita.set(visita.clientId, visita.slot.start)
      }
      const anteriorPrimeira = primeiraVisita.get(visita.clientId)
      if (!anteriorPrimeira || anteriorPrimeira > visita.slot.start) {
        primeiraVisita.set(visita.clientId, visita.slot.start)
      }
    }
  }

  registo.registar('appointments', linhasDeMarcacao.map((linha) => linha.id!))

  // ─── o dinheiro ───────────────────────────────────────────────────────────

  const caixa = fecharComandas({
    rng,
    comandas,
    lojas,
    equipa,
    tz,
    hoje,
    agora,
  })

  registo.registar('cash_sessions', caixa.sessoes.map((linha) => linha.id!))
  registo.registar('payments', caixa.pagamentos.map((linha) => linha.id!))
  registo.registar('cash_movements', caixa.movimentos.map((linha) => linha.id!))

  // ─── a escrita, de uma vez ────────────────────────────────────────────────

  const reservam = planeadas.filter((v) => v.reservesTime).length
  console.log(
    `  a escrever: ${CLIENTES.length} clientes · ${linhasDeMarcacao.length} marcações ` +
      `(${reservam} a ocupar horário) · ${caixa.sessoes.length} caixas · ` +
      `${caixa.pagamentos.length} pagamentos`,
  )

  await db.transaction(async (tx) => {
    await criarTabelaDeRegisto(tx)

    await inserirEmLotes(tx, users, linhasDeUtilizador, 200)
    await inserirEmLotes(tx, clientProfiles, linhasDePerfil, 200)
    await inserirEmLotes(tx, userRoles, linhasDePapel, 500)
    await inserirEmLotes(tx, clientNotes, linhasDeObservacao, 200)

    await inserirEmLotes(tx, appointments, linhasDeMarcacao, 150)
    await inserirEmLotes(tx, appointmentItems, linhasDeItem, 200)
    await inserirEmLotes(tx, appointmentStatusEvents, linhasDeEvento, 500)
    await inserirEmLotes(tx, appointmentStaffBlocks, linhasDeBloqueio, 500)
    await inserirEmLotes(tx, appointmentResourceBlocks, linhasDeRecurso, 500)

    await inserirEmLotes(tx, cashSessions, caixa.sessoes, 200)
    await inserirEmLotes(tx, appointmentDiscounts, caixa.descontos, 300)
    await inserirEmLotes(tx, payments, caixa.pagamentos, 400)
    await inserirEmLotes(tx, cashMovements, caixa.movimentos, 400)
    await inserirEmLotes(tx, comandaClosures, caixa.fechos, 400)

    /* A ficha da cliente conta a história dela: primeira visita, última visita e
       quantas vezes faltou. São colunas de `client_profiles` que o fecho da
       comanda não escreve — quem as escreve é quem gera o histórico. */
    for (const [clienteId, ultima] of ultimaVisita) {
      const primeira = (primeiraVisita.get(clienteId) ?? ultima).toISOString()
      const faltas = faltasPorCliente.get(clienteId) ?? 0
      await tx.execute(sql`
        update client_profiles
           set last_visit_at   = ${ultima.toISOString()},
               first_visit_at  = ${primeira},
               no_show_count   = ${faltas},
               requires_deposit = ${faltas >= 2}
         where id = ${clienteId}
      `)
    }

    await gravarRegisto(tx, registo)
  })

  console.log(`✓ demonstração no ar — ${registo.total} linhas registadas em demo_linhas`)
  console.log('  para desfazer: npm run db:demo -- --limpar')
}

// ─── o fecho das comandas e o caixa ─────────────────────────────────────────

interface EntradaDoCaixa {
  sessoes: (typeof cashSessions.$inferInsert)[]
  movimentos: (typeof cashMovements.$inferInsert)[]
  pagamentos: (typeof payments.$inferInsert)[]
  fechos: (typeof comandaClosures.$inferInsert)[]
  descontos: (typeof appointmentDiscounts.$inferInsert)[]
}

/**
 * Percorre as visitas concluídas por loja e por dia e faz o que a recepção faria:
 * abre a gaveta de manhã, fecha cada comanda à medida que a cliente sai, lança
 * uma sangria a meio da tarde e conta o dinheiro ao fim do dia.
 *
 * A gaveta de hoje fica ABERTA, e só ela: `cash_sessions_um_aberto_por_unidade`
 * é um índice único parcial, e duas abertas na mesma loja seriam recusadas pelo
 * banco — como devem ser.
 */
function fecharComandas(opcoes: {
  rng: Rng
  comandas: {
    id: string
    unitId: string
    fim: Date
    total: number
    itens: { id: string; serviceId: string; staffId: string; price: number }[]
  }[]
  lojas: { id: string; timezone: string }[]
  equipa: { id: string; userId: string }[]
  tz: string
  hoje: string
  agora: Date
}): EntradaDoCaixa {
  const { rng, comandas, lojas, equipa, hoje, agora } = opcoes
  const saida: EntradaDoCaixa = {
    sessoes: [],
    movimentos: [],
    pagamentos: [],
    fechos: [],
    descontos: [],
  }

  const fusoDaLoja = new Map(lojas.map((loja) => [loja.id, loja.timezone]))
  const utilizadorDaEquipa = new Map(equipa.map((pessoa) => [pessoa.id, pessoa.userId]))

  // loja → dia de parede → comandas daquele dia, por ordem de saída
  const porLojaEDia = new Map<string, Map<string, typeof comandas>>()
  for (const comanda of comandas) {
    const tz = fusoDaLoja.get(comanda.unitId) ?? opcoes.tz
    const dia = isoDateInZone(comanda.fim, tz)
    const dias = porLojaEDia.get(comanda.unitId) ?? new Map()
    const lista = dias.get(dia) ?? []
    lista.push(comanda)
    dias.set(dia, lista)
    porLojaEDia.set(comanda.unitId, dias)
  }

  for (const [unitId, dias] of porLojaEDia) {
    const tz = fusoDaLoja.get(unitId) ?? opcoes.tz

    for (const dia of [...dias.keys()].sort()) {
      const doDia = (dias.get(dia) ?? []).sort((a, b) => a.fim.getTime() - b.fim.getTime())
      if (doDia.length === 0) continue

      /* Quem abriu a gaveta e recebeu o dinheiro é quem esteve na loja naquele
         dia — a profissional do primeiro atendimento. Num salão de duas lojas
         com uma pessoa em cada, apontar sempre à mesma daria um histórico em
         que a colega de Valongo fechou o caixa da Maia. */
      const responsavel = utilizadorDaEquipa.get(doDia[0]!.itens[0]!.staffId) ?? null

      const sessaoId = randomUUID()
      const aberta = dia === hoje
      let naGaveta = 0

      for (const comanda of doDia) {
        // desconto de balcão, de vez em quando e nunca maior do que a comanda
        const desconto = rng.bool(0.12)
          ? Math.min(rng.pick([200, 500, 1_000]), Math.floor(comanda.total / 2))
          : 0
        if (desconto > 0) {
          saida.descontos.push({
            id: randomUUID(),
            appointmentId: comanda.id,
            amount: desconto,
            reason: rng.pick(['Cliente fiel', 'Campanha do mês', 'Indicou uma amiga']),
            appliedBy: responsavel,
          })
        }

        const aPagar = comanda.total - desconto
        for (const parcela of repartirPagamento(rng, aPagar)) {
          const emDinheiro = parcela.method === 'cash'
          saida.pagamentos.push({
            id: randomUUID(),
            appointmentId: comanda.id,
            cashSessionId: emDinheiro ? sessaoId : null,
            method: parcela.method,
            amount: parcela.amount,
            receivedBy: responsavel,
            paidAt: comanda.fim,
          })
          if (emDinheiro) {
            naGaveta += parcela.amount
            saida.movimentos.push({
              id: randomUUID(),
              cashSessionId: sessaoId,
              type: 'payment',
              amount: parcela.amount,
              note: `comanda ${comanda.id}`,
              createdBy: responsavel,
              occurredAt: comanda.fim,
            })
          }
        }

        saida.fechos.push({
          id: randomUUID(),
          appointmentId: comanda.id,
          closedBy: responsavel,
          closedAt: new Date(comanda.fim.getTime() + 300_000),
        })
      }

      // sangria para o cofre e reforço de troco — o avulso do dia
      if (naGaveta > 20_000 && rng.bool(0.35)) {
        const sangria = Math.min(naGaveta, rng.pick([10_000, 15_000, 20_000]))
        naGaveta -= sangria
        saida.movimentos.push({
          id: randomUUID(),
          cashSessionId: sessaoId,
          type: 'withdrawal',
          amount: sangria,
          note: 'Sangria para o cofre',
          createdBy: responsavel,
          occurredAt: zonedDateTime(dia, '16:00', tz),
        })
      }
      if (rng.bool(0.15)) {
        const reforco = rng.pick([2_000, 3_000, 5_000])
        naGaveta += reforco
        saida.movimentos.push({
          id: randomUUID(),
          cashSessionId: sessaoId,
          type: 'reinforcement',
          amount: reforco,
          note: 'Reforço de troco',
          createdBy: responsavel,
          occurredAt: zonedDateTime(dia, '11:30', tz),
        })
      }

      const esperado = ABERTURA_DE_CAIXA + naGaveta
      /* Uma diferença de vez em quando: é o que dá sentido à coluna. Gaveta que
         bate ao cêntimo todos os dias durante sete semanas não é um salão. */
      const contado = esperado + (rng.bool(0.2) ? rng.pick([-500, -200, 200, 500]) : 0)

      saida.sessoes.push({
        id: sessaoId,
        unitId,
        status: aberta ? 'open' : 'closed',
        openingAmount: ABERTURA_DE_CAIXA,
        closingCountedAmount: aberta ? null : contado,
        expectedAmount: aberta ? null : esperado,
        difference: aberta ? null : contado - esperado,
        openedBy: responsavel,
        closedBy: aberta ? null : responsavel,
        openedAt: zonedDateTime(dia, '08:45', tz),
        closedAt: aberta ? null : zonedDateTime(dia, '19:30', tz),
        note: null,
      })
    }
  }

  return saida
}

type Metodo = 'cash' | 'debit_card' | 'credit_card' | 'other'

/**
 * Como a cliente paga. O pix não entra: é serviço do Banco Central do Brasil e
 * não existe em Portugal — o balcão já não o oferece (ver `metodosDoPais`), e uma
 * demonstração com pix ensinaria o contrário.
 *
 * De vez em quando a conta parte-se em duas formas, que é o caso que o recibo e
 * o fecho de caixa têm de saber somar.
 */
function repartirPagamento(rng: Rng, total: number): { method: Metodo; amount: number }[] {
  if (total <= 0) return []

  const escolher = (): Metodo =>
    rng.weighted([
      ['debit_card', 45],
      ['cash', 30],
      ['credit_card', 22],
      ['other', 3],
    ] as const)

  if (total < 1_000 || !rng.bool(0.1)) return [{ method: escolher(), amount: total }]

  /* A segunda parcela é o resto, e não outra conta — assim a soma bate ao
     cêntimo com o total, que é o que `closeComanda` exige. */
  const primeira = Math.round(total / 2)
  const outra = escolher()
  const segunda: Metodo = outra === 'cash' ? 'debit_card' : 'cash'
  return [
    { method: outra, amount: primeira },
    { method: segunda, amount: total - primeira },
  ]
}

// ─── auxiliares ─────────────────────────────────────────────────────────────

/**
 * Que serviços saem juntos numa visita, montado a partir do catálogo real.
 *
 * O mapa do seed é escrito à mão com slugs do estúdio fictício (`corte-fem`,
 * `manicure`) que aqui não casam com nada. A regra que o substitui é a que se vê
 * ao balcão: o acrescento é curto e barato, e de outra família que o principal —
 * ninguém marca duas colorações na mesma tarde.
 */
function combosDoCatalogo(
  catalogo: readonly {
    id: string
    categoryId: string | null
    basePrice: number
    setupMin: number
    processingMin: number
    finishMin: number
  }[],
): Record<string, readonly string[]> {
  const acrescentos = catalogo.filter(
    (servico) =>
      servico.setupMin + servico.processingMin + servico.finishMin <= TETO_DE_ACRESCENTO_MIN &&
      servico.basePrice <= TETO_DE_ACRESCENTO_CENTIMOS,
  )
  const mapa: Record<string, readonly string[]> = {}
  for (const servico of catalogo) {
    mapa[servico.id] = acrescentos
      .filter((outro) => outro.id !== servico.id && outro.categoryId !== servico.categoryId)
      .map((outro) => outro.id)
  }
  return mapa
}

function jaChegou(status: string): boolean {
  return ['checked_in', 'in_progress', 'completed'].includes(status)
}

function jaComecou(status: string): boolean {
  return ['in_progress', 'completed'].includes(status)
}

/**
 * Insere em lotes: o Postgres aceita no máximo 65535 parâmetros por comando, e
 * o lote tem de caber nisso contando as colunas da tabela.
 *
 * É gémea da do seed de propósito — `seed/index.ts` executa `main()` ao ser
 * importado, portanto não há de lá nada para reaproveitar sem lhe disparar a
 * carga inteira.
 */
async function inserirEmLotes(
  escritor: { insert: Db['insert'] },
  tabela: Parameters<Db['insert']>[0],
  linhas: readonly Record<string, unknown>[],
  tamanho: number,
): Promise<void> {
  for (let i = 0; i < linhas.length; i += tamanho) {
    /* O molde é o preço de a função servir qualquer tabela: `values()` quer o
       tipo de inserção daquela em concreto, e aqui só se sabe que é *alguma*.
       Quem chama passa as linhas já com a forma certa, e é aí que o compilador
       as confere — este ponto é só a passagem. */
    await escritor.insert(tabela).values(linhas.slice(i, i + tamanho) as never[])
  }
}

main()
  .then(() => process.exit(0))
  .catch((erro: unknown) => {
    console.error('✗ demonstração falhou:', erro)
    process.exit(1)
  })
