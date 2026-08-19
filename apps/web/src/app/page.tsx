import { addDaysInZone, agruparPorFuso, isoDateInZone, janelaDoMes, zonedDateTime } from '@studio/core'
import {
  LIVE_APPOINTMENT_STATUSES,
  appointmentDiscounts,
  appointments,
  clientProfiles,
  units,
} from '@studio/db'
import { and, asc, count, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import Link from 'next/link'
import { OperateTopbar } from '@/components/operate/topbar'
import { AtualizaSozinho } from '@/components/ui/atualiza-sozinho'
import { Photo } from '@/components/ui/photo'
import { Section } from '@/components/ui/section'
import { db } from '@/lib/db'
import { formatDateLong, formatMoney, formatMoneyShort, formatMonthLong } from '@/lib/format'
import { pais } from '@/lib/pais'
import {
  agruparProducao,
  type LinhaDeProducao,
  type Producao,
  type ProducaoDeServico,
  type ProducaoDeStaff,
} from '@/lib/producao'
import { cn, href } from '@/lib/utils'
import {
  podeRede,
  requireGestaoOuMontra,
  unidadesVisiveis,
  type Acesso,
} from '@/server/auth/permissoes'
import { commissionSummaryByStaff } from '@/server/finance/commissions'
import { linhasDeProducao } from '@/server/finance/equipa'

export const dynamic = 'force-dynamic'

/** Uma loja com as duas janelas que a dona olha: o dia e o mês. */
interface UnidadePainel {
  id: string
  name: string
  slug: string
  district: string | null
  imageUrl: string | null
  /* o dia */
  hojeAgendados: number
  hojeConcluidos: number
  hojeCaixa: number
  hojePrevisto: number
  /* o mês */
  faturamento: number
  concluidos: number
  faturamentoAnterior: number
  concluidosAnterior: number
  marcadosCount: number
  marcadosFaturamento: number
  naoVieram: number
}

interface Painel {
  unidades: UnidadePainel[]
  /** Faturação de cada dia do mês, do dia 1 ao último — dias futuros ficam a 0. */
  serie: number[]
  diaAtual: number
  mesLabel: string
  /** `AAAA-MM` do mês desenhado — é por ele que a navegação anda para trás. */
  mesIso: string
  producao: Producao
  /** Quem marcou e não apareceu, no mês. Vive ao lado da taxa que dele sai. */
  naoVieram: number
  /**
   * Fichas abertas no mês, e o que a casa deve à equipa.
   *
   * `null` para quem não é a dona, e não zero: o gerente de uma loja não lê
   * comissão de ninguém (o ecrã de regras é `requireRede`) e "clientes novas"
   * é uma contagem de rede inteira, que ele veria recortada e errada. `null`
   * apaga a linha; zero escrevia um número falso.
   */
  rede: DadosDaRede | null
}

interface DadosDaRede {
  clientesNovas: number
  comissoesPendentes: number
  /** O pendente de cada profissional, para a coluna "a pagar" da equipa. */
  porStaff: Map<string, number>
}

interface Comparativo {
  atual: number
  anterior: number
}

/** Enum já validado no schema — junta os valores num IN() literal em vez de
 *  parametrizar um array, que pediria `= any()` explícito no driver. */
const STATUSES_AINDA_VALEM = sql.raw(
  LIVE_APPOINTMENT_STATUSES.map((status) => `'${status}'`).join(', '),
)

/**
 * O que entrou na gaveta, e não o que estava na etiqueta.
 *
 * Todas as somas de dinheiro deste painel liam `appointments.total_price`
 * sozinho. Só que o desconto dado ao balcão **não** mexe no preço congelado do
 * item — é uma decisão explícita do schema — e vive numa tabela à parte,
 * `appointment_discounts`, escrita no fecho da comanda. Somar só o
 * `total_price` era portanto contar cada euro de desconto como faturado: a
 * comanda de 60,00 € fechada com 10,00 € de desconto entrava na gaveta a
 * 50,00 € e no painel a 60,00 €.
 *
 * Não era número de canto. É o «no caixa» do cartão de cada loja e a
 * «Faturação · mês» em corpo grande — o número pelo qual, diz o comentário lá
 * abaixo, ela abre esta tela — e contaminava ainda o ticket médio e a variação
 * face ao mês anterior. Ao fim de um mês de descontos de fidelização a
 * faturação ficava sistematicamente acima do que entrou e não batia com o
 * somatório dos fechos de caixa, sem nada no ecrã que explicasse a diferença.
 *
 * O `left join` que isto exige é seguro para as contagens: em
 * `appointment_discounts` o `appointment_id` é único, portanto não multiplica
 * linha nenhuma. E vale para as janelas futuras também, onde ainda não há
 * desconto nenhum: ali a subtração é de zero, e ter uma expressão só evita que
 * a próxima soma nasça outra vez pelo bruto.
 */
const LIQUIDO = sql<number>`(${appointments.totalPrice} - coalesce(${appointmentDiscounts.amount}, 0))`

/**
 * Tudo o que o painel mostra, em duas consultas por fuso horário.
 *
 * Eram duas telas com dois carregadores: `loadToday` abria **uma consulta por
 * unidade** para somar o dia, e `loadDashboard` abria mais duas para somar o
 * mês. Com três lojas isso era seis idas ao banco para responder a perguntas
 * que a mesma linha de `appointments` responde de uma vez — o dia de hoje está
 * inteiro dentro da janela do mês, portanto é mais um `filter (where ...)` na
 * consulta que já existia, não outra consulta.
 *
 * Sobram duas por fuso: os números por loja, e o mês partido por dia. Na prática
 * duas ao todo, porque as lojas estão todas em Portugal.
 */
async function loadPainel(acesso: Acesso, mesRef: Date): Promise<Painel> {
  /* Duas âncoras no tempo, de propósito. O dia é sempre o dia que está a
     correr — a pauta da recepção não navega. `mesRef` é a que a placa segue, e
     só ela anda para trás. */
  const agora = new Date()
  const rede = podeRede(acesso)
  const vazio: Painel = {
    unidades: [],
    serie: [],
    diaAtual: 0,
    mesLabel: '',
    mesIso: '',
    producao: { porStaff: [], porServico: [] },
    naoVieram: 0,
    rede: null,
  }

  const todas = await db.select().from(units).where(eq(units.active, true)).orderBy(asc(units.name))
  /* O recorte vem antes das contagens, não depois: somar o dia de uma loja para
     esconder o número na tela ainda é ler o caixa de quem não é seu. */
  const rows = unidadesVisiveis(acesso, todas)
  if (rows.length === 0) return vazio

  const porUnidade = new Map<string, UnidadePainel>(
    rows.map((unit) => [
      unit.id,
      {
        id: unit.id,
        name: unit.name,
        slug: unit.slug,
        district: unit.district,
        imageUrl: unit.imageUrl,
        hojeAgendados: 0,
        hojeConcluidos: 0,
        hojeCaixa: 0,
        hojePrevisto: 0,
        faturamento: 0,
        concluidos: 0,
        faturamentoAnterior: 0,
        concluidosAnterior: 0,
        marcadosCount: 0,
        marcadosFaturamento: 0,
        naoVieram: 0,
      },
    ]),
  )

  /* O calendário do painel vem do primeiro fuso e os outros somam por cima:
     o mês de agosto tem os mesmos 31 dias em Lisboa e no Porto, e é a
     realidade do produto (todas as lojas em Portugal). */
  let serie: number[] = []
  let diaAtual = 0
  let mesLabel = ''
  let mesIso = ''
  /* As linhas de produção juntam-se cruas de todos os fusos e só depois se
     somam: fundir agregados de dois fusos seria refazer a soma à mão. */
  const producao: LinhaDeProducao[] = []
  /* A janela do mês que está no ecrã — o corrente ou o que o endereço pediu. */
  let janelaVisivel: { inicio: Date; fim: Date } | null = null

  for (const [timezone, doFuso] of agruparPorFuso(rows)) {
    const mes = janelaDoMes(mesRef, timezone)
    const hoje = isoDateInZone(agora, timezone)

    /*
      O fim do dia é a meia-noite seguinte no calendário, e não "mais 24 horas".
      A conta antiga somava 86 400 000 ms ao início do dia; na madrugada em que
      o relógio muda, o dia tem 23 ou 25 horas, e o caixa de domingo acabava
      uma hora cedo ou tarde — silenciosamente, no único dia do ano em que
      ninguém confere.
    */
    const diaInicio = zonedDateTime(hoje, '00:00', timezone).toISOString()
    const diaFim = zonedDateTime(addDaysInZone(hoje, 1), '00:00', timezone).toISOString()

    /* Os próximos sete dias começam agora, não à meia-noite: o que ela quer
       saber é o que ainda está por atender. */
    const em7Dias = zonedDateTime(addDaysInZone(hoje, 7), '00:00', timezone)
    const agoraTs = agora.toISOString()
    const em7DiasTs = em7Dias.toISOString()

    const ids = doFuso.map((unit) => unit.id)

    if (serie.length === 0) {
      serie = new Array<number>(mes.dias).fill(0)
      diaAtual = mes.diaDoMes
      mesLabel = formatMonthLong(mes.inicioIso)
      mesIso = mes.inicioIso.slice(0, 7)
      janelaVisivel = { inicio: mes.inicio, fim: mes.fim }
    }

    const diaExpr = sql<number>`extract(day from (${appointments.startsAt} at time zone ${timezone}))::int`

    const [linhas, diarias, itens] = await Promise.all([
      db
        .select({
          unitId: appointments.unitId,

          /* Cancelado e falta não são agenda: contá-los inflava tanto o número
             de visitas quanto o previsto. O enum não tem um valor 'cancelled'
             genérico — são três — então quem manda aqui é a lista de status
             que de facto ainda ocupam o horário. */
          hojeAgendados: sql<number>`count(*) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${diaInicio} and ${appointments.startsAt} < ${diaFim})::int`,
          hojeConcluidos: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${diaInicio} and ${appointments.startsAt} < ${diaFim})::int`,
          hojeCaixa: sql<number>`coalesce(sum(${LIQUIDO}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${diaInicio} and ${appointments.startsAt} < ${diaFim}), 0)::int`,
          /* O que o dia vale se ninguém faltar. É a pergunta que ela faz de
             manhã. */
          hojePrevisto: sql<number>`coalesce(sum(${LIQUIDO}) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${diaInicio} and ${appointments.startsAt} < ${diaFim}), 0)::int`,

          concluidos: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.inicioTs} and ${appointments.startsAt} < ${mes.fimTs})::int`,
          faturamento: sql<number>`coalesce(sum(${LIQUIDO}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.inicioTs} and ${appointments.startsAt} < ${mes.fimTs}), 0)::int`,
          concluidosAnterior: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.anteriorInicioTs} and ${appointments.startsAt} < ${mes.anteriorFimTs})::int`,
          faturamentoAnterior: sql<number>`coalesce(sum(${LIQUIDO}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.anteriorInicioTs} and ${appointments.startsAt} < ${mes.anteriorFimTs}), 0)::int`,
          marcadosCount: sql<number>`count(*) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${agoraTs} and ${appointments.startsAt} < ${em7DiasTs})::int`,
          marcadosFaturamento: sql<number>`coalesce(sum(${LIQUIDO}) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${agoraTs} and ${appointments.startsAt} < ${em7DiasTs}), 0)::int`,
          /* A falta é a única perda que o painel consegue medir: cadeira
             reservada, ninguém sentado, e ninguém a pagar. Vem da consulta que
             já estava aqui — é mais um `filter`, não outra ida ao banco. */
          naoVieram: sql<number>`count(*) filter (where ${appointments.status} = 'no_show' and ${appointments.startsAt} >= ${mes.inicioTs} and ${appointments.startsAt} < ${mes.fimTs})::int`,
        })
        .from(appointments)
        .leftJoin(appointmentDiscounts, eq(appointmentDiscounts.appointmentId, appointments.id))
        .where(
          and(
            inArray(appointments.unitId, ids),
            gte(appointments.startsAt, mes.anteriorInicio),
            lt(appointments.startsAt, em7Dias),
          ),
        )
        .groupBy(appointments.unitId),

      db
        .select({
          dia: diaExpr,
          valor: sql<number>`coalesce(sum(${LIQUIDO}), 0)::int`,
        })
        .from(appointments)
        .leftJoin(appointmentDiscounts, eq(appointmentDiscounts.appointmentId, appointments.id))
        .where(
          and(
            inArray(appointments.unitId, ids),
            eq(appointments.status, 'completed'),
            gte(appointments.startsAt, mes.inicio),
            lt(appointments.startsAt, mes.fim),
          ),
        )
        /*
          Ordinal, e não a expressão outra vez. `diaExpr` carrega o fuso como
          parâmetro; repeti-la no GROUP BY manda dois placeholders diferentes
          ($1 e $5) para o Postgres, que os trata como nós distintos e recusa
          a consulta com 42803 ("column must appear in the GROUP BY clause").
          Confirmado contra o banco antes de trocar.
        */
        .groupBy(sql`1`),

      linhasDeProducao(ids, { inicio: mes.inicio, fim: mes.fim }),
    ])

    for (const linha of linhas) {
      const atual = porUnidade.get(linha.unitId)
      if (!atual) continue
      atual.hojeAgendados = linha.hojeAgendados
      atual.hojeConcluidos = linha.hojeConcluidos
      atual.hojeCaixa = linha.hojeCaixa
      atual.hojePrevisto = linha.hojePrevisto
      atual.concluidos = linha.concluidos
      atual.faturamento = linha.faturamento
      atual.concluidosAnterior = linha.concluidosAnterior
      atual.faturamentoAnterior = linha.faturamentoAnterior
      atual.marcadosCount = linha.marcadosCount
      atual.marcadosFaturamento = linha.marcadosFaturamento
      atual.naoVieram = linha.naoVieram
    }

    for (const { dia, valor } of diarias) {
      const i = dia - 1
      if (i >= 0 && i < serie.length) serie[i] = (serie[i] ?? 0) + valor
    }

    producao.push(...itens)
  }

  const unidades = rows.map((unit) => porUnidade.get(unit.id) as UnidadePainel)

  return {
    unidades,
    serie,
    diaAtual,
    mesLabel,
    mesIso,
    producao: agruparProducao(producao),
    naoVieram: unidades.reduce((soma, unit) => soma + unit.naoVieram, 0),
    rede: rede && janelaVisivel ? await lerRede(janelaVisivel) : null,
  }
}

/**
 * Os dois números que são da dona e de mais ninguém.
 *
 * "Clientes novas" conta fichas com primeira visita no mês — a tabela não tem
 * unidade, portanto o número é da rede inteira e recortá-lo por loja daria uma
 * contagem errada em vez de uma contagem parcial. As comissões pendentes são o
 * assunto do ecrã de regras, que já é `requireRede`.
 *
 * Fica fora do laço dos fusos: são duas consultas por carregamento, não duas
 * por fuso, e o tecto de ligações do pooler é de contar.
 */
async function lerRede(janela: { inicio: Date; fim: Date }): Promise<DadosDaRede> {
  const [novas, comissoes] = await Promise.all([
    db
      .select({ n: count() })
      .from(clientProfiles)
      .where(
        and(
          gte(clientProfiles.firstVisitAt, janela.inicio),
          lt(clientProfiles.firstVisitAt, janela.fim),
        ),
      ),
    commissionSummaryByStaff(),
  ])

  return {
    clientesNovas: novas[0]?.n ?? 0,
    comissoesPendentes: comissoes.reduce((soma, linha) => soma + linha.pendingAmount, 0),
    /* Por pessoa, para a lista da equipa — a mesma leitura, sem repetir a
       consulta. É o pendente de todos os meses, não o deste: é o que a casa
       deve hoje, e é assim que a secção o rotula. */
    porStaff: new Map(comissoes.map((linha) => [linha.staffId, linha.pendingAmount])),
  }
}

/** `2026-08`. Ano de quatro dígitos e mês de 01 a 12 — nada mais entra. */
const MES_ISO = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * O instante que representa o mês pedido no endereço.
 *
 * Para o mês corrente é o agora — a placa compara-o com o mesmo trecho do mês
 * passado, que é a única comparação honesta a meio do mês. Para um mês fechado
 * é o meio-dia do último dia dele: `janelaDoMes` lê o dia do mês daquele
 * instante para saber até onde comparar, e o último dia dá mês-cheio contra
 * mês-cheio. Meio-dia e não meia-noite porque o fuso da loja pode empurrar a
 * hora para o dia anterior, e aí seria o penúltimo dia a mandar.
 *
 * O futuro cai no mês corrente sem se queixar: `?mes=2030-01` é um endereço que
 * alguém escreveu à mão ou um link envelhecido, e mostrar zero num ecrã de
 * faturação parece avaria. Endereço estragado idem.
 */
function instanteDoMes(pedido: string | undefined, agora: Date, timeZone: string): Date {
  if (!pedido || !MES_ISO.test(pedido)) return agora
  if (pedido >= isoDateInZone(agora, timeZone).slice(0, 7)) return agora

  const [ano, mes] = pedido.split('-').map(Number) as [number, number]
  // Dia 0 do mês seguinte é o último deste — a mesma conta de `janelaDoMes`.
  return new Date(Date.UTC(ano, mes, 0, 12))
}

/** O mês vizinho, `-1` para trás e `+1` para a frente. */
function mesVizinho(mesIso: string, passo: number): string {
  const [ano, mes] = mesIso.split('-').map(Number) as [number, number]
  const alvo = new Date(Date.UTC(ano, mes - 1 + passo, 1))
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, '0')}`
}

function variacaoPct({ atual, anterior }: Comparativo): number | null {
  // Sem base de comparação — mês passado zerado não divide.
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

/**
 * O painel da dona — o dia e o mês na mesma tela.
 *
 * Eram dois. `/` mostrava a pauta do dia com uma placa do mês ao lado e um
 * "ver painel completo →"; `/admin` mostrava o mês outra vez, com mais casas
 * decimais e uma segunda tabela por unidade. A mesma pergunta partida ao meio,
 * cada metade atrás de um separador diferente da barra de cima — e uma delas
 * chamada "Gestão", que é onde ninguém procura um número.
 *
 * Aqui é uma tela só, e a ordem é a do olhar: o dia em números na primeira
 * linha, o mês inteiro na placa larga logo abaixo, e as lojas por baixo — cada
 * loja com o dia dela e, na mesma linha, quanto já pôs no mês. A tabela "por
 * unidade" do painel antigo desapareceu porque era esta mesma lista com outra
 * janela; agora as duas janelas vivem na mesma linha, que é o único sítio onde
 * se conseguem comparar sem decorar números.
 *
 * A moldura é a mesma 90rem da barra e da gestão. A pauta antiga vivia em
 * `max-w-6xl` com a placa do mês encostada — sobravam duas margens vazias num
 * ecrã de trabalho, que era a queixa do espaço em branco.
 */
export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  /* A página mostra faturação das lojas. Antes era pública: qualquer um com o
     endereço lia o caixa da rede. Hoje ela é da dona e do gerente — quem atende
     é levado para a própria agenda, que é o "hoje" dela. */
  const acesso = await requireGestaoOuMontra()
  const { mes } = await searchParams
  const fuso = pais().fusoPadrao
  const agoraReal = new Date()
  const mesRef = instanteDoMes(mes, agoraReal, fuso)
  /* O mês fechado compara-se com o anterior inteiro; o corrente, com o mesmo
     trecho do passado. É a diferença entre "vendi mais em julho do que em
     junho" e "vou melhor do que ia no dia 12". */
  const mesCorrente = mesRef === agoraReal

  const { unidades, serie, diaAtual, mesLabel, mesIso, producao, naoVieram, rede } =
    await loadPainel(acesso, mesRef)

  const hoje = unidades.reduce(
    (acc, unit) => ({
      agendados: acc.agendados + unit.hojeAgendados,
      concluidos: acc.concluidos + unit.hojeConcluidos,
      caixa: acc.caixa + unit.hojeCaixa,
      previsto: acc.previsto + unit.hojePrevisto,
    }),
    { agendados: 0, concluidos: 0, caixa: 0, previsto: 0 },
  )

  const faturamento = unidades.reduce((acc, u) => acc + u.faturamento, 0)
  const faturamentoAnterior = unidades.reduce((acc, u) => acc + u.faturamentoAnterior, 0)
  const concluidos = unidades.reduce((acc, u) => acc + u.concluidos, 0)
  const concluidosAnterior = unidades.reduce((acc, u) => acc + u.concluidosAnterior, 0)
  const marcados = unidades.reduce((acc, u) => acc + u.marcadosFaturamento, 0)
  const marcadosCount = unidades.reduce((acc, u) => acc + u.marcadosCount, 0)
  const ticket = concluidos > 0 ? Math.round(faturamento / concluidos) : 0
  const ticketAnterior =
    concluidosAnterior > 0 ? Math.round(faturamentoAnterior / concluidosAnterior) : 0

  const maxMes = Math.max(1, ...unidades.map((u) => u.faturamento))
  const maxEquipa = Math.max(1, ...producao.porStaff.map((p) => p.liquido))
  /* Cinco linhas e não a lista inteira: a pergunta é "o que é que esta casa
     faz", e trinta serviços em fila respondem-na pior do que cinco. */
  const topServicos = producao.porServico.slice(0, 5)
  const maxServico = Math.max(1, ...topServicos.map((s) => s.liquido))
  /* Só há split por loja para quem vê mais do que uma. */
  const nomesDasLojas = new Map(unidades.map((unit) => [unit.id, unit.name]))
  /* A data do cabeçalho no fuso da loja, e não no do servidor. O servidor corre
     em UTC; no horário de verão Portugal está uma hora à frente, e entre as 23h
     e a meia-noite esta linha escrevia a data de ontem por cima dos números de
     hoje — que já vêm de `isoDateInZone`. A pauta fica aberta na recepção o dia
     inteiro, incluindo à hora de fechar. */
  const data = formatDateLong(isoDateInZone(agoraReal, fuso))

  return (
    <>
      <OperateTopbar acesso={acesso} active="hoje" />

      <main className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* A pauta do dia é o painel que fica aberto num canto da recepção o dia
            inteiro. Congelado no estado das nove da manhã ele mente. */}
        <AtualizaSozinho />

        <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            {/* "na rede" só é verdade para quem tem a rede. Para o gerente de
                uma loja o título seria uma promessa que a pauta não cumpre. */}
            <h1 className="display text-[1.75rem] leading-[1.1] font-normal sm:text-[2rem]">
              {acesso.papel === 'dona' ? 'Hoje na rede' : 'Hoje'}
            </h1>
            <p className="text-muted mt-1 text-sm first-letter:uppercase">{data}</p>
          </div>

          {/*
            O dia é uma frase, não um mostrador. Quatro números grandes no topo
            seriam o template de métrica que toda a ferramenta faz — e aqui
            disputariam o olhar com a faturação do mês, que está logo abaixo em
            corpo 44. Quem manda no espaço é a placa; o dia diz-se a falar.
          */}
          {unidades.length > 0 ? (
            <p className="text-body text-sm">
              <strong className="tnum text-(--text-strong) font-medium">{hoje.agendados}</strong>{' '}
              {hoje.agendados === 1 ? 'visita' : 'visitas'} ·{' '}
              <strong className="tnum text-(--text-strong) font-medium">
                {formatMoney(hoje.caixa)}
              </strong>{' '}
              no caixa
              {hoje.previsto > hoje.caixa ? (
                <>
                  {' '}
                  de <span className="tnum">{formatMoney(hoje.previsto)}</span> previstos
                </>
              ) : null}
            </p>
          ) : null}
        </header>

        {unidades.length === 0 ? (
          <p className="plate text-muted px-6 py-12 text-center text-sm">
            {acesso.papel === 'dona' ? (
              <>
                Nenhuma unidade ativa. Registe a primeira em{' '}
                <Link
                  href={href('/admin/unidades')}
                  className="text-(--text-strong) underline underline-offset-4"
                >
                  Unidades
                </Link>
                .
              </>
            ) : (
              /* Mandar o gerente para uma tela que ele não abre seria pior do
                 que não dizer nada. Quem cadastra unidade é a dona. */
              'Nenhuma loja atribuída a si ainda. Fale com a administração.'
            )}
          </p>
        ) : (
          <>
            {/*
              Um bloco só para o mês. A faturação manda — é o número pelo qual
              ela abre esta tela — e por isso ocupa a maior parte da placa e
              leva a forma do mês debaixo dele. Os outros acompanham numa coluna
              à direita: presentes, comparáveis, sem disputar o primeiro olhar.
            */}
            <div className="plate mb-9 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="p-6 lg:p-8">
                <div className="flex items-center justify-between gap-4">
                  <p className="label-caps text-muted">Faturação · {mesLabel}</p>
                  <NavegadorDeMes mesIso={mesIso} corrente={mesCorrente} />
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <p className="display tnum text-[2.75rem] leading-none xl:text-[3.25rem]">
                    {formatMoneyShort(faturamento)}
                  </p>
                  <Variacao
                    comparativo={{ atual: faturamento, anterior: faturamentoAnterior }}
                    legenda={mesCorrente ? 'vs. mês passado até hoje' : 'vs. mês anterior'}
                  />
                </div>

                <MesDiaADia serie={serie} diaAtual={diaAtual} mesLabel={mesLabel} />

                <Insights concluidos={concluidos} naoVieram={naoVieram} rede={rede} />
              </div>

              {/* Coluna em flex e não só `divide-y`: com três métricas em vez de
                  quatro, as linhas paravam a meio e o resto da placa ficava
                  branco ao lado do gráfico. Assim ocupam a altura que têm. */}
              <dl className="flex flex-col divide-y divide-(--border-subtle) border-t border-(--border-subtle) lg:border-t-0 lg:border-l">
                <MetricaLinha
                  label="Atendimentos"
                  value={String(concluidos)}
                  comparativo={{ atual: concluidos, anterior: concluidosAnterior }}
                />
                <MetricaLinha
                  label="Ticket médio"
                  value={formatMoney(ticket)}
                  comparativo={{ atual: ticket, anterior: ticketAnterior }}
                />
                <MetricaLinha
                  label="Próximos 7 dias"
                  value={formatMoneyShort(marcados)}
                  nota={`${marcadosCount} marcaç${marcadosCount === 1 ? 'ão' : 'ões'} de pé`}
                />
                {/* A quarta linha é da dona. A coluna foi desenhada para quatro
                    e com três parava a meio do gráfico ao lado. */}
                {rede ? (
                  <MetricaLinha
                    label="Comissões"
                    value={formatMoneyShort(rede.comissoesPendentes)}
                    nota="a pagar à equipa"
                  />
                ) : null}
              </dl>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <Section
                title="A equipa"
                className="mb-0"
                hint={
                  rede
                    ? '«A pagar» é o total pendente de comissão, de todos os meses — não só deste.'
                    : undefined
                }
              >
                <div className="plate">
                  {producao.porStaff.length === 0 ? (
                    <p className="text-muted px-5 py-8 text-center text-sm">
                      Sem atendimentos concluídos neste mês.
                    </p>
                  ) : (
                    producao.porStaff.map((pessoa) => (
                      <EquipaLinha
                        key={pessoa.staffId}
                        pessoa={pessoa}
                        max={maxEquipa}
                        aPagar={rede ? (rede.porStaff.get(pessoa.staffId) ?? 0) : null}
                        lojas={unidades.length > 1 ? nomesDasLojas : null}
                      />
                    ))
                  )}
                </div>
              </Section>

              {topServicos.length > 0 ? (
                <Section title="Serviços do mês" className="mb-0">
                  <div className="plate">
                    {topServicos.map((servico) => (
                      <ServicoLinha key={servico.serviceId} servico={servico} max={maxServico} />
                    ))}
                  </div>
                </Section>
              ) : null}

              <Section title="As lojas" className="mb-0">
                <div className="plate">
                  {unidades.map((unit) => (
                    <LojaLinha key={unit.id} unit={unit} maxMes={maxMes} />
                  ))}
                </div>
              </Section>
            </div>
          </>
        )}
      </main>
    </>
  )
}

/**
 * Duas setas ao lado do rótulo do mês, e mais nada.
 *
 * Sem selector de datas: a pergunta que se faz a este ecrã é "e no mês
 * passado?", uma ou duas vezes, e uma grelha de calendário para andar um passo
 * é mobiliário. Para a frente só se anda depois de se ter andado para trás — o
 * mês corrente é o fim da linha, e uma seta acesa que não leva a lado nenhum é
 * pior do que uma seta apagada.
 */
function NavegadorDeMes({ mesIso, corrente }: { mesIso: string; corrente: boolean }) {
  if (mesIso === '') return null

  return (
    <nav className="flex shrink-0 items-center gap-0.5" aria-label="Mês">
      <SetaDeMes mes={mesVizinho(mesIso, -1)} rotulo="Mês anterior" seta="←" />
      {corrente ? (
        <span aria-hidden className="text-muted/40 flex size-8 items-center justify-center text-sm">
          →
        </span>
      ) : (
        <SetaDeMes mes={mesVizinho(mesIso, 1)} rotulo="Mês seguinte" seta="→" />
      )}
    </nav>
  )
}

function SetaDeMes({ mes, rotulo, seta }: { mes: string; rotulo: string; seta: string }) {
  return (
    <Link
      href={{ pathname: '/', query: { mes } }}
      aria-label={rotulo}
      title={rotulo}
      className="text-muted hover:text-(--text-strong) flex size-8 items-center justify-center rounded-lg text-sm transition-colors hover:bg-(--surface-sunken)"
    >
      {seta}
    </Link>
  )
}

/** A seta e a percentagem, contra o trecho comparável do mês anterior. */
function Variacao({ comparativo, legenda }: { comparativo: Comparativo; legenda: string }) {
  const pct = variacaoPct(comparativo)
  if (pct === null) {
    return <span className="text-muted text-sm">primeiro mês com movimento</span>
  }
  return (
    <span className="text-sm">
      <span
        className={cn('tnum font-medium', pct >= 0 ? 'text-(--estado-bom)' : 'text-(--estado-mau)')}
      >
        {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
      </span>{' '}
      <span className="text-muted">{legenda}</span>
    </span>
  )
}

/**
 * O que o mês diz e os números não mostram, numa linha.
 *
 * A falta é a única perda que este sistema consegue medir — cadeira reservada,
 * ninguém sentado — e a percentagem é o que a torna comparável entre meses: seis
 * faltas em cem visitas e seis em vinte são duas casas diferentes. As clientes
 * novas são o outro lado da mesma pergunta: quem entrou pela porta pela
 * primeira vez.
 *
 * Uma frase, e não dois cartões. O painel fala por frases — mais um mostrador
 * de métrica é o que faz um ecrã de trabalho parecer uma apresentação
 * (DESIGN §11).
 */
function Insights({
  concluidos,
  naoVieram,
  rede,
}: {
  concluidos: number
  naoVieram: number
  rede: DadosDaRede | null
}) {
  const marcadas = concluidos + naoVieram
  const frases: string[] = []

  if (marcadas > 0) {
    const pct = Math.round((naoVieram / marcadas) * 100)
    frases.push(
      naoVieram === 0
        ? 'ninguém faltou'
        : naoVieram + (naoVieram === 1 ? ' falta' : ' faltas') + ' (' + pct + '%)',
    )
  }
  if (rede && rede.clientesNovas > 0) {
    frases.push(
      rede.clientesNovas + (rede.clientesNovas === 1 ? ' cliente nova' : ' clientes novas'),
    )
  }

  if (frases.length === 0) return null
  return <p className="text-muted mt-4 text-sm first-letter:uppercase">{frases.join(' · ')}</p>
}

/**
 * Uma profissional: o que fez, e o que a casa lhe deve.
 *
 * A ordem da lista é o ranking — quem fez mais está em cima, e é só isso. Sem
 * medalhas nem lugares numerados: isto é um ecrã que a dona abre ao pé da
 * equipa, e transformar o mês de cada uma numa classificação com pódio muda a
 * conversa que se tem a seguir. A barra dá a proporção sem dar uma nota.
 *
 * O split por loja só aparece a quem vê mais do que uma, e só nas linhas de
 * quem atendeu em mais do que uma — nas outras seria a repetição do número que
 * está ao lado.
 */
function EquipaLinha({
  pessoa,
  max,
  aPagar,
  lojas,
}: {
  pessoa: ProducaoDeStaff
  max: number
  /** `null` para quem não é a dona: comissão não é assunto do gerente. */
  aPagar: number | null
  /** Nomes das lojas, ou `null` quando só há uma à vista. */
  lojas: Map<string, string> | null
}) {
  const split =
    lojas && pessoa.porUnidade.length > 1
      ? pessoa.porUnidade
          .map((linha) => (lojas.get(linha.unitId) ?? '—') + ' ' + formatMoney(linha.liquido))
          .join(' · ')
      : null

  return (
    <div className="flex items-center gap-4 border-b border-(--border-subtle) px-5 py-4 last:border-0 sm:gap-5">
      {/* A mesma pastilha da coluna da agenda: é assim que a dona já reconhece
          cada pessoa, e um segundo código de cor seria um a mais. */}
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: pessoa.cor }}
      />

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium">{pessoa.nome}</h3>
        <p className="text-muted truncate text-sm">
          <span className="tnum">{pessoa.atendimentos}</span>{' '}
          {pessoa.atendimentos === 1 ? 'atendimento' : 'atendimentos'}
          {split ? <span className="hidden sm:inline"> · {split}</span> : null}
        </p>
      </div>

      <BarraDeProporcao parte={pessoa.liquido} total={max} />

      <dl className="flex shrink-0 items-baseline gap-5 sm:gap-7">
        <Numero label="no mês" value={formatMoney(pessoa.liquido)} wide />
        {aPagar === null ? null : (
          <Numero label="a pagar" value={aPagar === 0 ? '—' : formatMoney(aPagar)} wide />
        )}
      </dl>
    </div>
  )
}

/** O que sai mais desta casa. A contagem à esquerda, o dinheiro à direita. */
function ServicoLinha({ servico, max }: { servico: ProducaoDeServico; max: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-(--border-subtle) px-5 py-4 last:border-0 sm:gap-5">
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium">{servico.nome}</h3>
        <p className="text-muted text-sm">
          <span className="tnum">{servico.vezes}</span>x no mês
        </p>
      </div>

      <BarraDeProporcao parte={servico.liquido} total={max} />

      <dl className="flex shrink-0 items-baseline">
        <Numero label="líquido" value={formatMoney(servico.liquido)} wide />
      </dl>
    </div>
  )
}

/**
 * A proporção contra o maior da lista.
 *
 * Não é gráfico: é a comparação a acontecer na própria linha, do mesmo feitio
 * que a das lojas. `aria-hidden` porque o número que ela ilustra está a dois
 * centímetros e escrito por extenso — repeti-la em voz alta seria dizer o mesmo
 * duas vezes a quem ouve o ecrã.
 */
function BarraDeProporcao({ parte, total }: { parte: number; total: number }) {
  return (
    <span
      aria-hidden
      className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-(--border-subtle) sm:block xl:w-24"
    >
      <span
        className="block h-full rounded-full bg-(--accent)"
        style={{ width: Math.round((parte / total) * 100) + '%' }}
      />
    </span>
  )
}

/**
 * O mês como forma, não como número: a dona vê num relance se a segunda
 * quinzena está a puxar, se houve um buraco na semana passada, e quanto do mês
 * ainda falta. É a mesma soma da placa ao lado, partida por dia.
 */
function MesDiaADia({
  serie,
  diaAtual,
  mesLabel,
}: {
  serie: number[]
  diaAtual: number
  mesLabel: string
}) {
  if (serie.length === 0) return null
  const max = Math.max(1, ...serie)
  const melhor = serie.indexOf(max) + 1

  return (
    <div className="mt-8">
      <div
        className="flex h-20 items-end gap-px xl:h-24"
        role="img"
        aria-label={
          max > 1
            ? `Faturação dia a dia de ${mesLabel}. Melhor dia: ${melhor}, com ${formatMoney(max)}.`
            : `Ainda sem faturação em ${mesLabel}.`
        }
      >
        {serie.map((valor, i) => {
          const dia = i + 1
          const futuro = dia > diaAtual
          return (
            <span
              key={dia}
              title={futuro ? `dia ${dia}` : `dia ${dia} — ${formatMoney(valor)}`}
              className={cn(
                'block min-h-px flex-1 rounded-t-[1px]',
                futuro
                  ? 'bg-(--border-subtle)/60'
                  : valor > 0
                    ? dia === diaAtual
                      ? 'bg-(--text-strong)'
                      : 'bg-(--accent)'
                    : 'bg-(--border-strong)',
              )}
              style={{
                height: futuro || valor === 0 ? '2px' : `${Math.max(4, (valor / max) * 100)}%`,
              }}
            />
          )
        })}
      </div>
      <div className="text-muted tnum mt-2 flex justify-between text-xs">
        <span>1</span>
        <span>{serie.length}</span>
      </div>
    </div>
  )
}

function MetricaLinha({
  label,
  value,
  comparativo,
  nota,
}: {
  label: string
  value: string
  comparativo?: Comparativo
  nota?: string
}) {
  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-4 lg:py-5">
      <dt className="label-caps text-muted">{label}</dt>
      <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="tnum text-(--text-strong) text-xl leading-none font-medium">{value}</span>
        {comparativo ? (
          <PctCurto comparativo={comparativo} />
        ) : nota ? (
          <span className="text-muted text-xs">{nota}</span>
        ) : null}
      </dd>
    </div>
  )
}

function PctCurto({ comparativo }: { comparativo: Comparativo }) {
  const pct = variacaoPct(comparativo)
  if (pct === null) return <span className="text-muted text-xs">sem comparação</span>
  return (
    <span
      className={cn(
        'tnum text-xs font-medium',
        pct >= 0 ? 'text-(--estado-bom)' : 'text-(--estado-mau)',
      )}
    >
      {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

/**
 * Uma loja: o dia dela, e o que já pôs no mês.
 *
 * Era duas linhas em duas telas — a pauta de `/` com os números de hoje, e a
 * tabela "por unidade" de `/admin` com os do mês. A mesma loja, o mesmo nome, o
 * mesmo link para a mesma agenda. Aqui é uma linha só, e a coluna do mês entra
 * a partir de `lg`, separada por um fio: onde não há largura para as duas
 * janelas, quem fica é o dia — é isso que se abre de manhã ao balcão.
 *
 * A foto entra pequena e à esquerda, do tamanho de uma etiqueta. Serve para
 * reconhecer a loja de relance — a dona não lê "Valongo", ela vê a sala. É a
 * mesma fotografia que a cliente vê grande no agendamento.
 */
function LojaLinha({ unit, maxMes }: { unit: UnidadePainel; maxMes: number }) {
  const restantes = unit.hojeAgendados - unit.hojeConcluidos

  return (
    <Link
      href={href(`/agenda/${unit.slug}`)}
      className="group flex items-center gap-4 border-b border-(--border-subtle) px-5 py-4 transition-colors last:border-0 hover:bg-(--surface-sunken) sm:gap-5"
    >
      <Photo
        src={unit.imageUrl}
        alt=""
        name={unit.name}
        sizes="64px"
        className="aspect-square w-12 shrink-0 sm:w-14"
        interactive
      />

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium">{unit.name}</h3>
        <p className="text-muted truncate text-sm">
          {unit.district ?? '—'}
          <span className="hidden sm:inline">
            {' · '}
            {restantes === 0 ? 'dia encerrado' : `${restantes} por atender`}
          </span>
        </p>
      </div>

      {/*
        Os números alinham à direita e em largura fixa para as linhas formarem
        coluna — é o que faz a lista ser lida de cima para baixo, que é como se
        compara loja com loja.
      */}
      <dl className="flex shrink-0 items-baseline gap-5 sm:gap-7">
        <Numero label="agenda" value={String(unit.hojeAgendados)} />
        <Numero label="feitos" value={String(unit.hojeConcluidos)} />
        <Numero label="caixa" value={formatMoney(unit.hojeCaixa)} wide />
      </dl>

      <div className="hidden shrink-0 items-center gap-3 border-l border-(--border-subtle) pl-5 lg:flex xl:pl-6">
        {/* A barra é a comparação — não é gráfico decorativo, é a proporção
            entre lojas na própria linha. */}
        <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-(--border-subtle) xl:w-24">
          <span
            className="block h-full rounded-full bg-(--accent)"
            style={{ width: `${Math.round((unit.faturamento / maxMes) * 100)}%` }}
          />
        </span>
        <Numero label="no mês" value={formatMoney(unit.faturamento)} wide />
      </div>

      <span
        aria-hidden
        className="text-muted group-hover:text-(--text-strong) hidden transition-[color,transform] group-hover:translate-x-0.5 sm:inline"
      >
        →
      </span>
    </Link>
  )
}

function Numero({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'w-24 text-right sm:w-28' : 'w-10 text-right sm:w-12'}>
      <dd className="tnum text-(--text-strong) text-lg leading-none font-medium sm:text-xl">
        {value}
      </dd>
      <dt className="text-muted mt-1 text-xs">{label}</dt>
    </div>
  )
}

