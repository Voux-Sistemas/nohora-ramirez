import { partesDoPreco } from '@/lib/format'
import { montarPrecario, repartirEmColunas, type BlocoDoPrecario } from '@/lib/precario'
import { cn } from '@/lib/utils'
import type { GrupoPrecario } from '@/server/vitrine'

/**
 * O preçário, como preçário impresso.
 *
 * Não é uma tabela de dados nem uma grade de cartões de serviço: é o cartão que
 * fica no balcão. É o desenho que um menu de restaurante bom usa há um século,
 * pelo mesmo motivo — a pessoa percorre nomes e só depois olha o número.
 *
 * O DEFEITO QUE ESTA VERSÃO CORRIGE, e que o cliente viu antes de nós: cada
 * linha fechava com um fio horizontal, e cinquenta e oito fios empilhados não
 * se leem como lista, leem-se como parede. O fio saiu e entrou o pontilhado do
 * menu (`.leader-dots`), que corre no sentido da leitura em vez de a cortar. É
 * a mesma informação com metade do peso gráfico.
 *
 * Três coisas mais mudaram, e nenhuma é enfeite:
 *
 * 1. **Os cêntimos redondos saíram.** "15,00 €" repetido cinquenta e oito vezes
 *    é ruído numa coluna que existe para ser lida de relance — ver
 *    `partesDoPreco`, que os mantém onde eles são preço a sério. O símbolo
 *    passou a voz quieta, para o número ficar sozinho a marcar a coluna.
 * 2. **As colunas passaram a ser repartidas por nós** e não pelo `columns` do
 *    CSS, que com `break-inside-avoid` desiste de equilibrar — era o buraco
 *    branco de meia página no fundo à esquerda. Ver `repartirEmColunas`.
 * 3. **A tabela comparada deixou de ser igual às listas.** É o único bloco da
 *    página com duas colunas de preço, e é a pergunta real de quem lê um
 *    preçário de cabeleireiro; ganhou cabeçalho de coluna com largura de
 *    verdade e tarja alternada. Ser o único bloco desenhado assim é o que dá
 *    ritmo à secção — antes eram seis blocos com o mesmo desenho do princípio
 *    ao fim, e ler seis vezes o mesmo é o que cansa.
 *
 * DURAÇÃO NÃO APARECE AQUI, de propósito. O preçário em papel do estúdio não a
 * traz, e a duração que o sistema conhece é a que a agenda precisa para reservar
 * a cadeira — número operacional, sujeito a ajuste por profissional. Publicá-lo
 * como promessa transformaria uma estimativa interna em compromisso com a
 * cliente. Quem quer saber quanto demora chega a esse número na tela de marcação,
 * onde ele já vem com a pessoa e o horário reais.
 */
/**
 * As duas únicas palavras deste ficheiro que não vêm da base de dados.
 *
 * Vêm de secções diferentes do dicionário — `comum.desde` e
 * `loja.categoriasDoPrecario` — e por isso entram como objecto montado na
 * página, e não como uma secção inteira. Os nomes dos serviços, as colunas e
 * as notas continuam em português: são conteúdo da casa, não interface.
 */
export type TextosDoPrecario = { categorias: string; desde: string }

export function Precario({
  grupos,
  textos,
}: {
  grupos: readonly GrupoPrecario[]
  textos: TextosDoPrecario
}) {
  const blocos = montarPrecario(grupos)
  if (blocos.length === 0) return null

  return (
    <>
      <IndiceDosPrecos blocos={blocos} textos={textos} />

      {/*
        Uma tabela comparada não cabe numa coluna de metade da página: a 640px
        cada coluna tem ~290px e as duas colunas de preço esmagam o nome do
        serviço. Por isso o preçário parte-se em faixas — as corridas de blocos
        comparados ocupam a largura toda, as de lista repartem-se por duas
        colunas de texto. A ordem do papel mantém-se exactamente.
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
          /* `items-start`: sem ele as duas colunas da grade esticam à altura da
             mais alta e a régua de bronze do último bloco da coluna curta fica
             a flutuar a meio do branco. */
          <div key={chave} className="grid items-start gap-x-14 md:grid-cols-2 lg:gap-x-20">
            {repartirEmColunas(faixa).map((coluna, i) => (
              <div key={coluna[0]?.id ?? i}>
                {coluna.map((bloco) => (
                  <BlocoEmLista key={bloco.id} bloco={bloco} />
                ))}
              </div>
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
 * Cinquenta e oito linhas não são demasiadas — são o que o salão faz. O que
 * faltava era poder entrar por uma delas: quem quer saber quanto custa uma
 * coloração não devia ter de passar os olhos por três blocos até lá chegar. O
 * "desde" resolve metade das visitas sem sequer saltar.
 *
 * Pastilhas em fila e não a grade de fios que estava aqui: com o mesmo desenho
 * das linhas de preço, o índice lia-se como mais uma tabela e ninguém percebia
 * que era para clicar. E uma fila que quebra sozinha nunca deixa a célula órfã
 * que cinco categorias numa grade de três deixava.
 *
 * É uma lista de âncoras e nada mais: funciona sem JavaScript, e ao imprimir
 * fica a valer como sumário.
 */
function IndiceDosPrecos({
  blocos,
  textos,
}: {
  blocos: readonly BlocoDoPrecario[]
  textos: TextosDoPrecario
}) {
  if (blocos.length < 3) return null

  return (
    <nav aria-label={textos.categorias} className="mb-12 sm:mb-16">
      <ul className="flex flex-wrap gap-2.5">
        {blocos.map((bloco) => (
          <li key={bloco.id}>
            <a
              href={`#${bloco.ancora}`}
              className="rounded-plate group flex items-baseline gap-2.5 border border-(--border-subtle) bg-(--surface) px-3.5 py-2 transition-colors hover:border-(--accent)"
            >
              <span className="text-body text-[0.9375rem] leading-snug transition-colors group-hover:text-(--text-strong)">
                {bloco.nome}
              </span>
              <span className="flex shrink-0 items-baseline gap-1">
                <span className="label-caps text-muted">{textos.desde}</span>
                <span className="tnum text-[0.8125rem] whitespace-nowrap text-(--text-strong)">
                  <Preco cents={bloco.desde} />
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
    <section id={bloco.ancora} className="mb-12 scroll-mt-24 sm:mb-16">
      <TituloDoBloco bloco={bloco} />

      <dl className="mt-6">
        {bloco.linhas.map((linha) => (
          <div key={linha.id} className="group flex items-baseline gap-3 py-2">
            <dt className="text-body text-[0.9375rem] leading-snug transition-colors group-hover:text-(--text-strong)">
              {linha.nome}
            </dt>

            {/* Decoração, e por isso fora da árvore: um leitor de ecrã que
                anunciasse o pontilhado leria um ponto por cada 7px de linha. */}
            <span aria-hidden className="leader-dots group-hover:text-(--accent)" />

            {/* `tnum` alinha a coluna de preços; `whitespace-nowrap` impede
                que "120 €" parta entre o número e o símbolo. */}
            <dd className="tnum shrink-0 text-[0.9375rem] whitespace-nowrap text-(--text-strong)">
              <Preco cents={linha.precos[0]?.preco ?? 0} />
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
 *
 * A TARJA ALTERNADA é o bege da página a aparecer por baixo da folha — a secção
 * inteira assenta em `--surface-raised` e a tarja é `--surface`. Não há cor
 * nova nenhuma: é o mesmo par que já separa a folha do papel de fundo, usado
 * aqui para o olho não perder a linha entre o nome à esquerda e o segundo preço
 * a doze centímetros de distância. Sem pontilhado neste bloco, de propósito —
 * com duas colunas de preço o pontilhado teria de parar na primeira e a fileira
 * ficava com dois traços de comprimentos diferentes.
 */
function BlocoComparado({ bloco }: { bloco: BlocoDoPrecario }) {
  return (
    <section id={bloco.ancora} className="mb-12 scroll-mt-24 sm:mb-16">
      <TituloDoBloco bloco={bloco} />

      <dl className="mt-6">
        {/*
          O cabeçalho das colunas é DECORAÇÃO: cada preço já traz o rótulo
          dentro da própria célula, para quem lê por leitor de ecrã e para o
          telemóvel. Sem o `aria-hidden`, "Curto" seria anunciado duas vezes
          por linha.
        */}
        <div
          aria-hidden
          className="hidden items-baseline gap-5 border-b border-(--border-strong) px-3 pb-2.5 sm:flex"
        >
          <span className="min-w-0 flex-1" />
          {bloco.colunas.map((coluna) => (
            <span key={coluna} className="label-caps text-muted w-[6.5rem] text-right">
              {coluna}
            </span>
          ))}
        </div>

        {bloco.linhas.map((linha, i) => (
          <div
            key={linha.id}
            className={cn(
              'rounded-plate flex flex-wrap items-baseline gap-x-5 gap-y-1.5 px-3 py-3 sm:flex-nowrap',
              i % 2 === 1 && 'bg-(--surface)',
            )}
          >
            {/* `basis-full` dá ao nome a linha inteira no telemóvel; a partir
                de `sm` volta a ser a primeira célula da fileira. */}
            <dt className="text-body basis-full text-[0.9375rem] leading-snug sm:min-w-0 sm:flex-1 sm:basis-auto">
              {linha.nome}
            </dt>

            {linha.precos.map((preco) => (
              <dd
                key={preco.rotulo}
                className="flex shrink-0 items-baseline gap-2 sm:w-[6.5rem] sm:justify-end"
              >
                {/* `sm:sr-only` e nunca `sm:hidden`: `display:none` tira o
                    rótulo da árvore de acessibilidade, e a partir de `sm` um
                    leitor de ecrã passaria a ouvir "Brushing, 15 €, 20 €" sem
                    saber qual é qual. `sr-only` sai do fluxo sem sair da
                    árvore. */}
                <span className="label-caps text-muted sm:sr-only">{preco.rotulo}</span>
                <span className="tnum text-[0.9375rem] whitespace-nowrap text-(--text-strong)">
                  <Preco cents={preco.preco} />
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

/**
 * O número forte, o símbolo quieto.
 *
 * Numa coluna de cinquenta e oito preços o "€" repetido com o mesmo peso do
 * número faz a coluna parecer o dobro da largura que tem. Baixá-lo de cor e um
 * ponto de tamanho — `em`, para acompanhar seja qual for o corpo de quem o
 * chama — deixa os algarismos sozinhos a desenhar a coluna, que é o que a
 * cliente está a percorrer.
 */
function Preco({ cents }: { cents: number }) {
  const { valor, moeda } = partesDoPreco(cents)
  return (
    <>
      {valor}
      <span className="text-muted ml-1 text-[0.85em]">{moeda}</span>
    </>
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
    <p className="text-muted mt-4 max-w-[42ch] text-[0.8125rem] leading-relaxed italic">
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
