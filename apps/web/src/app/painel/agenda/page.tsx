import { isoDateInZone } from '@studio/core'
import { CalendarDays } from 'lucide-react'
import { PainelShell, Vazio } from '@/components/shell/painel-shell'
import { NavegadorPeriodo } from '@/components/painel/navegador'
import {
  AgendaDaSemana,
  AgendaDoDia,
  AgendaDoMes,
  ResumoDoPeriodo,
  rotuloDoPeriodo,
} from '@/components/painel/minha-agenda'
import { EscolherPessoa } from '@/components/painel/escolher-pessoa'
import { ehVista, intervaloDaVista, somarDias } from '@/lib/periodo'
import { listStaffAdmin } from '@/server/admin/staff'
import { podeGerir } from '@/server/auth/permissoes'
import { contextoDoPainel } from '@/server/painel/contexto'
import { agendaDoProfissional, resumir } from '@/server/scheduling/minha-agenda'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'A minha agenda' }

const BASE = '/painel/agenda'

/**
 * A agenda de uma pessoa — dia, semana ou mês.
 *
 * ── O que faltava ────────────────────────────────────────────────────────
 * O sistema só sabia mostrar o dia de uma LOJA. A profissional que quisesse
 * ver a semana abria a grade da recepção sete vezes e lia a própria coluna em
 * cada uma; quem atende em duas casas, catorze vezes. Não havia nenhuma tela
 * que respondesse "o que vou fazer esta semana".
 *
 * Agora há, e a escala é uma escolha: dia para o que vem a seguir, semana para
 * onde há buraco, mês para como está a correr. A vista e a data vivem no
 * endereço — a agenda de uma quinta-feira é um link que se manda pelo WhatsApp.
 *
 * Quem gere vê também a agenda de quem quiser, pelo selector de pessoa. É a
 * resposta à pergunta da dona ("o que é que a Juliana tem na quinta?") sem ter
 * de abrir a grade de um dia de cada vez.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; d?: string; quem?: string }>
}) {
  const { v, d, quem } = await searchParams
  const { acesso, unidades, unidade } = await contextoDoPainel()

  const vista = ehVista(v) ? v : 'dia'
  /* "Hoje" é hoje na casa activa, não no servidor: a recepção de Valongo e um
     processo em UTC discordam sobre a meia-noite todos os dias. */
  const hoje = isoDateInZone(new Date(), unidade?.timezone ?? 'UTC')
  const data = /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? (d as string) : hoje

  /*
    Quem gere pode olhar para a agenda de outra pessoa; quem não gere só vê a
    sua, e o parâmetro é ignorado — o porteiro está aqui, e não no selector.
  */
  const equipa = podeGerir(acesso) ? await listStaffAdmin(acesso.unidadeIds) : []
  const alvo = podeGerir(acesso)
    ? (equipa.find((pessoa) => pessoa.id === quem)?.id ?? acesso.staffId ?? equipa[0]?.id ?? null)
    : acesso.staffId

  const pessoa = equipa.find((item) => item.id === alvo)
  const titulo = !alvo || alvo === acesso.staffId ? 'A minha agenda' : `Agenda de ${pessoa?.name ?? ''}`

  if (!alvo) {
    return (
      <PainelShell
        acesso={acesso}
        unidades={unidades}
        unidade={unidade}
        activa="agenda"
        titulo="Agenda"
      >
        <Vazio titulo="Esta conta não tem agenda própria" icon={CalendarDays}>
          A sua conta administra o salão mas não atende — por isso não há uma agenda pessoal para
          mostrar. O dia das casas está em <strong>Hoje</strong>.
        </Vazio>
      </PainelShell>
    )
  }

  const { de, ate } = intervaloDaVista(vista, data)
  const compromissos = await agendaDoProfissional(alvo, de, ate)
  const resumo = resumir(compromissos)

  const casas = new Set(compromissos.map((item) => item.unidadeSlug))
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(de, i))

  return (
    <PainelShell
      acesso={acesso}
      unidades={unidades}
      unidade={unidade}
      activa="agenda"
      titulo={titulo}
      /* A agenda pessoal atravessa as casas — quem atende em duas vê as duas na
         mesma semana. Prender a tela ao selector de casa daria uma semana com
         buracos que não existem. */
      semCasa
      acao={
        equipa.length > 1 ? (
          <EscolherPessoa
            base={BASE}
            equipa={equipa.map((item) => ({ id: item.id, nome: item.name }))}
            activo={alvo}
            vista={vista}
            data={data}
          />
        ) : null
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <NavegadorPeriodo
          base={BASE}
          vista={vista}
          data={data}
          hoje={hoje}
          rotulo={rotuloDoPeriodo(vista, data, de, ate)}
        />
        <ResumoDoPeriodo visitas={resumo.visitas} valor={resumo.valor} minutos={resumo.minutos} />
      </div>

      <div className="mt-7">
        {vista === 'dia' ? (
          <AgendaDoDia compromissos={compromissos} varias={casas.size > 1} />
        ) : null}
        {vista === 'semana' ? (
          <AgendaDaSemana dias={dias} compromissos={compromissos} hoje={hoje} base={BASE} />
        ) : null}
        {vista === 'mes' ? (
          <AgendaDoMes data={data} compromissos={compromissos} hoje={hoje} base={BASE} />
        ) : null}
      </div>
    </PainelShell>
  )
}
