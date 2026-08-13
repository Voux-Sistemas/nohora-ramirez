'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { carregarCatalogo, carregarDias, carregarProfissionais } from '@/app/marcar/actions'
import { EscolherCasa } from '@/components/marcar/escolher-casa'
import { EscolherQuando } from '@/components/marcar/escolher-quando'
import { EscolherQuem } from '@/components/marcar/escolher-quem'
import { EscolherServicos } from '@/components/marcar/escolher-servicos'
import { Confirmar } from '@/components/marcar/confirmar'
import { Resumo } from '@/components/marcar/resumo'
import { Wordmark } from '@/components/brand/mark'
import { Button } from '@/components/ui/button'
import { formatDuration, formatMoney } from '@/lib/format'
import type {
  CasaEscolhivel,
  DiaLivre,
  HorarioLivre,
  ProfissionalEscolhivel,
  ServicoEscolhivel,
} from '@/lib/marcacao-tipos'
import { cn, href } from '@/lib/utils'

/**
 * A marcação inteira, numa tela.
 *
 * ── O que isto substitui ──────────────────────────────────────────────────
 * Quatro páginas encadeadas (`/agendar` → `/agendar/[casa]` →
 * `.../horarios` → `.../confirmar`), com o carrinho a viajar na querystring.
 * Voltar atrás era uma navegação: mudar de ideia sobre a profissional depois
 * de ver os horários obrigava a refazer o caminho, e o botão do navegador
 * levava a estados que não existiam mais.
 *
 * Aqui o estado é um só e vive nesta tela. Andar para trás é clicar no passo
 * — nada se perde, e cada passo que muda invalida só o que depende dele: trocar
 * de profissional apaga a hora escolhida, mas não os serviços.
 *
 * ── O que continua no servidor ────────────────────────────────────────────
 * Tudo o que é verdade: o catálogo que a casa entrega, quem sabe fazer o
 * carrinho, que horas existem. A tela nunca calcula disponibilidade — ela
 * escolhe um INSTANTE, e é o servidor que replaneja quem faz o quê ao gravar.
 * Duas clientes na mesma tela não podem marcar a mesma cadeira.
 */

type Passo = 'casa' | 'servicos' | 'quem' | 'quando' | 'confirmar'

const ROTULOS: Record<Passo, string> = {
  casa: 'Casa',
  servicos: 'Serviços',
  quem: 'Com quem',
  quando: 'Quando',
  confirmar: 'Confirmar',
}

export function FluxoMarcacao({
  casas,
  casaInicial,
  catalogoInicial,
  cliente,
}: {
  casas: readonly CasaEscolhivel[]
  /** Slug vindo de `?casa=` — quem chegou pela página da casa já respondeu. */
  casaInicial: string | null
  /** Catálogo já carregado no servidor quando a casa veio decidida. */
  catalogoInicial: readonly ServicoEscolhivel[] | null
  /** Quem já entrou não volta a datilografar o nome e o telemóvel. */
  cliente: { nome: string; telefone: string } | null
}) {
  /* Com uma casa só não há escolha a fazer — e um passo que se responde
     sozinho é um passo que não devia existir. */
  const casaFixa = casas.length === 1 ? (casas[0] ?? null) : null
  const inicial = casaFixa ?? casas.find((item) => item.slug === casaInicial) ?? null

  const passos: Passo[] = useMemo(
    () => (casas.length > 1 && !casaInicial ? ['casa', 'servicos', 'quem', 'quando', 'confirmar'] : ['servicos', 'quem', 'quando', 'confirmar']),
    [casas.length, casaInicial],
  )

  const [casa, setCasa] = useState<CasaEscolhivel | null>(inicial)
  const [passo, setPasso] = useState<Passo>(inicial ? 'servicos' : 'casa')

  const [catalogo, setCatalogo] = useState<readonly ServicoEscolhivel[]>(catalogoInicial ?? [])
  const [escolhidos, setEscolhidos] = useState<string[]>([])

  const [equipa, setEquipa] = useState<readonly ProfissionalEscolhivel[]>([])
  const [profissional, setProfissional] = useState<string | null>(null)

  const [dias, setDias] = useState<readonly DiaLivre[]>([])
  const [deData, setDeData] = useState<string | null>(null)
  const [dia, setDia] = useState<string | null>(null)
  const [horario, setHorario] = useState<HorarioLivre | null>(null)

  const [aCarregar, iniciar] = useTransition()

  const servicos = useMemo(
    () => catalogo.filter((item) => escolhidos.includes(item.id)),
    [catalogo, escolhidos],
  )
  const duracao = servicos.reduce((soma, item) => soma + item.duracaoMin, 0)
  const preco = servicos.reduce((soma, item) => soma + item.preco, 0)
  const precoVaria = servicos.some((item) => item.precoVaria)

  // ── transições ────────────────────────────────────────────────────────────

  const escolherCasa = useCallback((nova: CasaEscolhivel) => {
    setCasa(nova)
    /* Trocar de casa invalida tudo o que vem abaixo: o catálogo é da casa, a
       equipa é da casa e a agenda também. Manter o carrinho seria oferecer um
       serviço que a outra loja talvez não faça. */
    setEscolhidos([])
    setEquipa([])
    setProfissional(null)
    setDias([])
    setDia(null)
    setHorario(null)
    setPasso('servicos')

    iniciar(async () => {
      setCatalogo(await carregarCatalogo(nova.slug))
    })
  }, [])

  const alternarServico = useCallback((id: string) => {
    setEscolhidos((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    )
    /* O carrinho mudou: quem o faz e que horas existem mudaram com ele. */
    setProfissional(null)
    setDias([])
    setDia(null)
    setHorario(null)
  }, [])

  const escolherProfissional = useCallback((id: string | null) => {
    setProfissional(id)
    setDias([])
    setDia(null)
    setHorario(null)
  }, [])

  const irPara = useCallback(
    (destino: Passo) => {
      if (destino === 'quem' && casa) {
        iniciar(async () => {
          const lista = await carregarProfissionais(casa.slug, escolhidos)
          setEquipa(lista)
        })
      }
      if (destino === 'quando' && casa) {
        iniciar(async () => {
          const lista = await carregarDias(casa.slug, escolhidos, profissional, deData)
          setDias(lista)
          /* Abrir já no primeiro dia com vaga: mandar a cliente clicar num
             calendário para descobrir onde há hora é trabalho que o servidor
             já fez. */
          const primeiro = lista.find((item) => item.horarios.length > 0)
          setDia(primeiro?.data ?? null)
        })
      }
      setPasso(destino)
    },
    [casa, escolhidos, profissional, deData],
  )

  /** Outra janela de catorze dias, para a frente ou para trás. */
  const mudarJanela = useCallback(
    (novaData: string | null) => {
      if (!casa) return
      setDeData(novaData)
      setHorario(null)
      iniciar(async () => {
        const lista = await carregarDias(casa.slug, escolhidos, profissional, novaData)
        setDias(lista)
        const primeiro = lista.find((item) => item.horarios.length > 0)
        setDia(primeiro?.data ?? lista[0]?.data ?? null)
      })
    },
    [casa, escolhidos, profissional],
  )

  // ── o que falta para avançar ──────────────────────────────────────────────

  const podeAvancar =
    (passo === 'casa' && Boolean(casa)) ||
    (passo === 'servicos' && escolhidos.length > 0) ||
    passo === 'quem' ||
    (passo === 'quando' && Boolean(horario))

  const indice = passos.indexOf(passo)
  const seguinte = passos[indice + 1]

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── a faixa da casa ──────────────────────────────────────────────── */}
      <header className="bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-5 py-3.5 sm:px-8">
          <Link href={href('/')} className="rounded-plate shrink-0" aria-label="Nohora Ramirez">
            <Wordmark size="sm" align="left" />
          </Link>

          {/*
            A trilha é clicável para trás e só para trás. É o que substitui o
            botão "voltar" de cada uma das quatro páginas antigas — e como o
            estado não se perde, voltar não custa nada.
          */}
          <nav aria-label="Passos" className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
            {passos.map((item, i) => {
              const feito = i < indice
              const atual = item === passo
              return (
                <button
                  key={item}
                  type="button"
                  disabled={!feito}
                  onClick={() => irPara(item)}
                  aria-current={atual ? 'step' : undefined}
                  className={cn(
                    'rounded-plate min-h-9 shrink-0 px-2 text-[0.8125rem] whitespace-nowrap transition-colors',
                    atual && 'font-medium text-(--on-ink)',
                    feito && 'text-(--on-ink-muted) hover:text-(--on-ink)',
                    !feito && !atual && 'text-(--on-ink-muted)/45',
                  )}
                >
                  {i > 0 ? <span aria-hidden className="mr-1.5 opacity-40">›</span> : null}
                  {ROTULOS[item]}
                </button>
              )
            })}
          </nav>
        </div>

        {/* O progresso é uma régua que enche, não bolinhas numeradas. */}
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={passos.length}
          aria-valuenow={indice + 1}
          aria-valuetext={`Passo ${indice + 1} de ${passos.length}: ${ROTULOS[passo]}`}
          className="h-px w-full bg-(--border-on-ink)"
        >
          <div
            className="h-full bg-(--accent) transition-[width] duration-700 ease-(--ease-out-quint)"
            style={{ width: `${((indice + 1) / passos.length) * 100}%` }}
          />
        </div>
      </header>

      {/* ── o passo, e o extrato ao lado ─────────────────────────────────── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-8 pb-32 sm:px-8 sm:pt-12">
        <div className="lg:grid lg:grid-cols-[1fr_19rem] lg:items-start lg:gap-14">
          <div className="min-w-0">
            {passo === 'casa' ? (
              <EscolherCasa casas={casas} escolhida={casa?.slug ?? null} aoEscolher={escolherCasa} />
            ) : null}

            {passo === 'servicos' ? (
              <EscolherServicos
                casa={casa}
                catalogo={catalogo}
                escolhidos={escolhidos}
                aCarregar={aCarregar}
                aoAlternar={alternarServico}
              />
            ) : null}

            {passo === 'quem' ? (
              <EscolherQuem
                equipa={equipa}
                escolhido={profissional}
                aCarregar={aCarregar}
                aoEscolher={escolherProfissional}
              />
            ) : null}

            {passo === 'quando' ? (
              <EscolherQuando
                dias={dias}
                dia={dia}
                horario={horario}
                aCarregar={aCarregar}
                semProfissional={profissional === null}
                aoEscolherDia={(data) => {
                  setDia(data)
                  setHorario(null)
                }}
                aoEscolherHorario={setHorario}
                aoMudarJanela={mudarJanela}
                deData={deData}
              />
            ) : null}

            {passo === 'confirmar' && casa && horario && dia ? (
              <Confirmar
                casa={casa}
                servicos={servicos}
                horario={horario}
                dia={dia}
                profissional={profissional}
                cliente={cliente}
              />
            ) : null}
          </div>

          {/*
            O extrato acompanha a decisão desde o primeiro serviço escolhido.
            Só a partir de `lg`: no telemóvel a coluna única é o desenho certo,
            e o que precisa de estar sempre à vista já está na barra de baixo.
          */}
          <aside className="hidden lg:sticky lg:top-8 lg:block">
            <Resumo
              casa={casa}
              servicos={servicos}
              profissional={equipa.find((pessoa) => pessoa.id === profissional) ?? null}
              horario={horario}
              dia={dia}
            />
          </aside>
        </div>
      </main>

      {/* ── a barra de baixo ─────────────────────────────────────────────── */}
      {passo !== 'confirmar' ? (
        <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-(--border-subtle) bg-(--surface-raised)/95 shadow-(--shadow-lift) backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-5 py-3 sm:px-8">
            <div className="min-w-0 flex-1 text-sm">
              {servicos.length > 0 ? (
                <>
                  <p className="truncate font-medium">
                    {servicos.length} {servicos.length === 1 ? 'serviço' : 'serviços'}
                    <span className="text-muted font-normal"> · {formatDuration(duracao)}</span>
                  </p>
                  <p className="tnum text-muted text-[0.8125rem]">
                    {precoVaria ? 'desde ' : ''}
                    {formatMoney(preco)}
                  </p>
                </>
              ) : (
                <p className="text-muted">
                  {passo === 'casa' ? 'Escolha a casa' : 'Escolha o que vai fazer'}
                </p>
              )}
            </div>

            <Button
              type="button"
              size="lg"
              disabled={!podeAvancar || aCarregar || !seguinte}
              onClick={() => seguinte && irPara(seguinte)}
            >
              {aCarregar ? 'Um momento…' : seguinte === 'confirmar' ? 'Rever e confirmar' : 'Continuar'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
