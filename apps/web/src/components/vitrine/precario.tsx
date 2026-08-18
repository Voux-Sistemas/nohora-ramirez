import { formatMoney, formatMoneyShort } from '@/lib/format'
import { montarPrecario, type BlocoDoPrecario } from '@/lib/precario'
import type { GrupoPrecario } from '@/server/vitrine'

/**
 * O preçário, como preçário impresso.
 *
 * Não é uma tabela de dados nem uma grade de cartões de serviço: é o cartão que
 * fica no balcão. Duas colunas de texto, título de bloco em Bodoni, linha com
 * nome à esquerda e preço à direita, fio fino entre uma e outra. É o desenho que
 * um menu de restaurante bom usa há um século, pelo mesmo motivo: a pessoa
 * percorre nomes e só depois olha o número.
 *
 * O que mudou depois da reunião foi a densidade, não o desenho. Sessenta e sete
 * linhas seguidas sem forma de saltar foi o que o cliente chamou de "cansativa
 * de ler": entra um índice por cima, com o "desde" de cada categoria, para quem
 * chega com uma pergunta só. E os dois blocos de cabelo, que traziam a mesma
 * lista de nove serviços a dois preços, passam a ser uma tabela de nove linhas
 * com duas colunas — ver `lib/precario.ts`, que é onde a fusão vive.
 *
 * DURAÇÃO NÃO APARECE AQUI, de propósito. O preçário em papel do estúdio não a
 * traz, e a duração que o sistema conhece é a que a agenda precisa para reservar
 * a cadeira — número operacional, sujeito a ajuste por profissional. Publicá-lo
 * como promessa transformaria uma estimativa interna em compromisso com a
 * cliente. Quem quer saber quanto demora chega a esse número na tela de marcação,
 * onde ele já vem com a pessoa e o horário reais.
 *
 * Colunas de CSS e não grade: o conteúdo é fluxo de texto de alturas desiguais,
 * que é exatamente o problema que `columns` resolve e `grid` não. `break-inside`
 * mantém o bloco inteiro de um lado só — meia lista de "Mãos e Pés" numa coluna
 * e metade na outra faria a cliente ler o mesmo título duas vezes.
 */
export function Precario({ grupos }: { grupos: readonly GrupoPrecario[] }) {
  const blocos = montarPrecario(grupos)
  if (blocos.length === 0) return null

  return (
    <>
      <IndiceDosPrecos blocos={blocos} />

      {/*
        Uma tabela comparada não cabe numa coluna de metade da página: a 640px
        cada coluna tem ~290px e as duas colunas de preço esmagam o nome do
        serviço. Por isso o preçário parte-se em faixas — as corridas de blocos
        comparados ocupam a largura toda, as de lista continuam nas duas colunas
        de texto de sempre. A ordem do papel mantém-se exactamente.
      */}
      {emFaixas(blocos).map((faixa) => {
        const chave = faixa[0]?.id ?? ''
        return faixa[0]?.colunas.length ? (
          <div key={chave}>
            {faixa.map((bloco) => (
              <BlocoComparado key={bloco.id} bloco={bloco} />
            ))}
          </div>
        ) : (
          <div key={chave} className="gap-x-14 sm:columns-2 lg:gap-x-20">
            {faixa.map((bloco) => (
              <BlocoEmLista key={bloco.id} bloco={bloco} />
            ))}
          </div>
        )
      })}
    </>
  )
}

/**
 * O mapa do preçário.
 *
 * Sessenta e sete linhas não são demasiadas — são o que o salão faz. O que
 * faltava era poder entrar por uma delas: quem quer saber quanto custa uma
 * coloração não devia ter de passar os olhos por três blocos até lá chegar. O
 * "desde" resolve metade das visitas sem sequer saltar.
 *
 * É uma lista de âncoras e nada mais: funciona sem JavaScript, e ao imprimir
 * fica a valer como sumário.
 */
function IndiceDosPrecos({ blocos }: { blocos: readonly BlocoDoPrecario[] }) {
  if (blocos.length < 3) return null

  return (
    <nav aria-label="Categorias do preçário" className="mb-14 sm:mb-16">
      <ul className="grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-14">
        {blocos.map((bloco) => (
          <li key={bloco.id}>
            <a
              href={`#${bloco.ancora}`}
              className="group flex items-baseline justify-between gap-4 border-b border-(--border-subtle) py-3 transition-colors hover:border-(--accent)"
            >
              <span className="text-body text-[0.9375rem] leading-snug transition-colors group-hover:text-(--text-strong)">
                {bloco.nome}
              </span>
              <span className="flex shrink-0 items-baseline gap-1.5">
                <span className="label-caps text-muted">desde</span>
                <span className="tnum text-[0.9375rem] whitespace-nowrap text-(--text-strong)">
                  {formatMoneyShort(bloco.desde)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function BlocoEmLista({ bloco }: { bloco: BlocoDoPrecario }) {
  return (
    <section id={bloco.ancora} className="mb-11 scroll-mt-24 break-inside-avoid sm:mb-14">
      <TituloDoBloco bloco={bloco} />

      <dl className="mt-5">
        {bloco.linhas.map((linha) => (
          <div
            key={linha.id}
            className="flex items-baseline justify-between gap-5 border-b border-(--border-subtle) py-2.5"
          >
            <dt className="text-body text-[0.9375rem] leading-snug">{linha.nome}</dt>
            {/* `tnum` alinha a coluna de preços; `whitespace-nowrap` impede
                que "120,00 €" parta entre o número e o símbolo. */}
            <dd className="tnum shrink-0 text-[0.9375rem] whitespace-nowrap text-(--text-strong)">
              {formatMoney(linha.precos[0]?.preco ?? 0)}
            </dd>
          </div>
        ))}
      </dl>

      <NotaDoBloco bloco={bloco} />
    </section>
  )
}

/**
 * A mesma lista a dois preços.
 *
 * A tabela não é uma `<table>`: continua a ser a `<dl>` do preçário, com um
 * `<dt>` para o serviço e um `<dd>` por preço. É HTML válido, é a mesma
 * estrutura do bloco simples, e evita ter de reconstruir num telemóvel o que
 * uma tabela obriga a desmontar.
 *
 * A 360px o nome fica com a linha só para ele e os preços descem para a linha
 * de baixo, lado a lado, cada um com o seu rótulo; a partir de `sm` volta tudo
 * a uma fileira com os rótulos em cima, uma vez só.
 */
function BlocoComparado({ bloco }: { bloco: BlocoDoPrecario }) {
  return (
    <section id={bloco.ancora} className="mb-11 scroll-mt-24 sm:mb-14">
      <TituloDoBloco bloco={bloco} />

      <dl className="mt-5">
        {/*
          O cabeçalho das colunas é DECORAÇÃO: cada preço já traz o rótulo
          dentro da própria célula, para quem lê por leitor de ecrã e para o
          telemóvel. Sem o `aria-hidden`, "Curto" seria anunciado duas vezes
          por linha.
        */}
        <div
          aria-hidden
          className="hidden items-baseline gap-5 border-b border-(--border-strong) pb-2 sm:flex"
        >
          <span className="min-w-0 flex-1" />
          {bloco.colunas.map((coluna) => (
            <span key={coluna} className="label-caps text-muted w-[6rem] text-right">
              {coluna}
            </span>
          ))}
        </div>

        {bloco.linhas.map((linha) => (
          <div
            key={linha.id}
            className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-b border-(--border-subtle) py-2.5 sm:flex-nowrap"
          >
            {/* `basis-full` dá ao nome a linha inteira no telemóvel; a partir
                de `sm` volta a ser a primeira célula da fileira. */}
            <dt className="text-body basis-full text-[0.9375rem] leading-snug sm:min-w-0 sm:flex-1 sm:basis-auto">
              {linha.nome}
            </dt>

            {linha.precos.map((preco) => (
              <dd
                key={preco.rotulo}
                className="flex shrink-0 items-baseline gap-2 sm:w-[6rem] sm:justify-end"
              >
                {/* `sm:sr-only` e nunca `sm:hidden`: `display:none` tira o
                    rótulo da árvore de acessibilidade, e a partir de `sm` um
                    leitor de ecrã passaria a ouvir "Brushing, 15 €, 20 €" sem
                    saber qual é qual. `sr-only` sai do fluxo sem sair da
                    árvore. */}
                <span className="label-caps text-muted sm:sr-only">{preco.rotulo}</span>
                <span className="tnum text-[0.9375rem] whitespace-nowrap text-(--text-strong)">
                  {formatMoney(preco.preco)}
                </span>
              </dd>
            ))}
          </div>
        ))}
      </dl>

      <NotaDoBloco bloco={bloco} />
    </section>
  )
}

function TituloDoBloco({ bloco }: { bloco: BlocoDoPrecario }) {
  return (
    <>
      <h3 className="display display-md">{bloco.nome}</h3>
      <div className="rule-bronze mt-3.5 w-12" />
    </>
  )
}

/* A ressalva ao pé do bloco, onde ela está no papel — depois dos preços, que é
   onde a dúvida aparece. */
function NotaDoBloco({ bloco }: { bloco: BlocoDoPrecario }) {
  if (!bloco.nota) return null
  return (
    <p className="text-muted mt-3.5 max-w-[42ch] text-[0.8125rem] leading-relaxed italic">
      {bloco.nota}
    </p>
  )
}

/* Corridas de blocos do mesmo feitio, pela ordem em que vêm. */
function emFaixas(blocos: readonly BlocoDoPrecario[]): BlocoDoPrecario[][] {
  const faixas: BlocoDoPrecario[][] = []
  for (const bloco of blocos) {
    const ultima = faixas[faixas.length - 1]
    const mesmoFeitio = ultima && (ultima[0]?.colunas.length ?? 0) > 0 === (bloco.colunas.length > 0)
    if (ultima && mesmoFeitio) ultima.push(bloco)
    else faixas.push([bloco])
  }
  return faixas
}
