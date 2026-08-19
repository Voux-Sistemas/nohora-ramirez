# DESIGN — NOHORA RAMIREZ, Beauty Studio

Documento do sistema visual. Descreve o que está construído, não o que se
pretende construir. Quem for mexer num ecrã lê isto antes.

A fonte da verdade é [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css)
— este ficheiro explica as decisões; o CSS executa-as. Onde os dois divergirem, o
CSS está certo e este documento está velho.

---

## 1. A cena que decide tudo

> Camila abre o telemóvel às 22h40 de domingo, no escuro do quarto, para ver se
> consegue a Juliana no sábado. Doze horas depois a mesma interface está num
> tablet no balcão, sob LED de salão a bater em espelho e mármore, com uma
> cliente de pé à espera.

**A segunda cena manda.** Claro não é o padrão seguro aqui — é a única leitura
que sobrevive ao reflexo do balcão. Mas é um claro de *pedra quente*, não de
papel branco: às 22h40 no escuro, branco puro machuca.

O tema escuro é um segundo vestido de verdade (carvão quente), não a inversão do
claro. As duas cenas são reais e as duas foram verificadas no navegador.

## 2. Cor

**Estratégia: comprometida.** A tinta quase preta carrega superfície de verdade
— a capa, a barra de operação, a ação principal, o selo. Não é
neutro-com-um-toque-de-cor.

A paleta sai do material de um salão de alto padrão: **travertino, tinta, bronze
escovado**. O preto vem da própria logo — o monograma NR é monocromático, a
marca não herdou cor nenhuma, então a tinta *é* a cor da marca.

| Rampa | Papel | Observação |
|---|---|---|
| `stone-50…950` | travertino quente, o chão do produto | `stone-600` é `L 0.50`, não `0.545`: em `0.545` o texto secundário lia 3.98:1 sobre o fundo rebaixado |
| `ink-50…950` | a cor da marca | `ink-900` é a tinta do claro; `ink-950` é a do escuro |
| `bronze-100…700` | metal escovado — detalhe, régua, selo | **nunca é botão** |
| `signal-good/warn/bad` | só onde estado é facto do produto | escurecidos até passarem 4.5:1 sobre o fundo rebaixado, o pior caso em que aparecem |

Tudo em OKLCH. Componente **nunca** chama cor bruta — chama papel semântico. É o
que faz o white-label funcionar sem tocar em componente: trocar de salão é
trocar valores em `:root`.

**As cores de estado são recalibradas por tema, não reaproveitadas.** O
componente pede sempre `--estado-bom` / `--estado-aviso` / `--estado-mau`,
nunca `--color-signal-*` cru — é essa indireção que permite dois pares de
valores sem tocar em componente nenhum. No claro (L 0.485–0.5) o verde, o
âmbar e o vermelho passam 4.5:1 sobre `--surface-sunken` claro; sobre o
`--surface-sunken` escuro (bem mais próximo do preto) esses mesmos tons
chumbam a uns 3.3:1. `[data-theme='dark']` redefine os três para versões
claras (L 0.73–0.78, mesmo matiz), verificadas de novo contra o pior caso —
selo de estado dentro de linha de tabela.

### Papéis semânticos

`--surface` · `--surface-raised` · `--surface-sunken` · `--surface-ink` ·
`--surface-invert` · `--border-subtle` · `--border-strong` · `--text-strong` ·
`--text-body` · `--text-muted` · `--accent` · `--accent-wash` · `--focus`

Dois pares merecem atenção porque são fáceis de confundir:

- **`--surface-ink`** é a marca. Cabeçalho, selo de confirmação, placa sem foto.
  Continua tinta com a luz baixa — no escuro desce um degrau (`ink-950`) para
  ler como faixa própria em vez de sumir no fundo.
- **`--surface-invert`** é papel, não marca: a superfície que *contrasta com o
  fundo*, seja ele qual for. Tinta no claro, pedra clara no escuro. Carrega ação
  principal, seleção, e o bloco "acontecendo agora" da agenda.

Usar tinta onde cabia inverso foi o bug mais caro do sistema: no escuro o
atendimento em curso ficava mais *escuro* que os marcados e a distinção invertia
justamente no ecrã em que a receção precisa dela.

### Contraste

Corpo ≥ 4.5:1, texto grande ≥ 3:1, inclusive placeholder. Verificado no pior
caso de cada token, não no melhor. Sobre superfícies invertidas (`invert`,
`ink`) os tokens `--text-muted` e `--focus` são **redefinidos localmente** para
o filho herdar a versão legível sem saber onde está:

```
[--text-muted:var(--on-invert-muted)] [--focus:var(--on-invert)]
```

## 3. Tipografia

| Voz | Família | Regra |
|---|---|---|
| Display | **Bodoni Moda** | **só ≥ 28px.** Hairline de didone em 14px não se lê |
| Texto / UI | **Archivo** | grotesca de notícia, numeral tabular bom, larga o suficiente para tablet |

Bodoni foi escolhida porque **é a letra da logo** — didone de altíssimo
contraste com eixo de tamanho óptico. Aproximar o monograma com outra serifa
seria erro. O par é por eixo de contraste (didone + grotesca), que é o par de
editorial de moda desde sempre — não duas grotescas parecidas.

Classes: `.display` (+ `.display-xl` / `.display-lg` / `.display-md`, todas em
`clamp()`), `.label-caps`, `.tnum`, `.measure` (68ch).

**Exceção documentada à regra dos 28px:** o logotipo (`Wordmark`) usa Bodoni em
17px com tracking largo em caixa alta. Caixa alta em versalete largo não tem
hairline em risco — é o desenho da própria logo.

`.label-caps` **não é eyebrow de secção.** É rótulo de dado: aparece onde há um
valor logo em seguida (nome da unidade num cartão, "a partir de" num preço),
nunca solto acima de um título.

## 4. Forma, elevação, camada

- **Uma escala de raio só:** `--radius-plate: 4px`. Placa e controlo
  partilham. Pílula é reservada ao que é genuinamente pílula — chip, selo,
  avatar.
- **Placa usa fio, não sombra.** Elevação é rara: barra fixa, diálogo, menu.
- Sombra é sempre **tingida do próprio chão**, nunca preta.
- Camada tem escala nomeada — `--z-sticky` … `--z-tooltip`. Nada de `9999`.

## 5. Movimento

Saída exponencial (`--ease-out-quint`, `--ease-out-expo`). **Sem bounce:** o
produto marca hora e cobra dinheiro.

Não há entrada genérica aplicada a todas as secções. O movimento autoral do produto
acontece **uma vez só**: o selo, quando o horário fica marcado. A coroa
desenha-se, as folhas abrem atrás dela e o swash atravessa por último — a mesma
ordem em que a mão desenharia.

`prefers-reduced-motion` não é opcional. Quem desligou movimento recebe o selo
**pronto**, não vazio: o conteúdo é o padrão e a animação é o enfeite.

**Movimento conduzido pela rolagem** entrou com a montra, e traz uma armadilha
própria: `animation-timeline: view()` e `scroll()` não têm duração, e o bloco
global de `prefers-reduced-motion` no fim de `globals.css` só sabe encurtar
durações. Uma animação de rolagem atravessa esse bloco intacta. Por isso toda a
regra nova vive dentro de `@media (prefers-reduced-motion: no-preference)`, e
não apenas dentro do `@supports`.

O estado por omissão é **visível**: sem suporte, sem JavaScript ou com movimento
desligado, o conteúdo está pronto e é a animação que não existe. Nunca há ecrã
vazio à espera de um observador.

## 6. Marca

[`components/brand/mark.tsx`](apps/web/src/components/brand/mark.tsx) —
`Wreath`, `Monogram`, `Wordmark`.

O gesto distintivo é o **swash**: nasce no N, passa por baixo do R e **rompe o
círculo** da coroa. É intencional e vem da logo original; não é um traço solto.

Derivada gráfica: `.rule-bronze`, o fio que fecha um bloco — vem da coroa
botânica.

## 7. Tema claro/escuro

**O claro é o padrão de todo o produto** — inclusive na área da cliente, que
antes escurecia sozinha a seguir o sistema operativo. Agora ninguém escurece
sem escolher: quem quiser escuro pede, no controlo da barra.

### Mecanismo

O tema vive em `<html data-theme="light" | "dark">`, nunca em `div` nem em
`prefers-color-scheme` sozinho. É decisão de servidor, a partir de um cookie
(`tema`, lido por [`lib/tema.ts`](apps/web/src/lib/tema.ts)): `app/layout.tsx`
é `async`, lê o cookie antes de render, e já entrega o `data-theme` certo no
primeiro HTML. Sem script inline, sem flash, sem divergência de hidratação —
e `color-scheme` finalmente vale para barra de deslocamento e controlo nativo,
coisa que só funciona a partir de `<html>`, nunca de um nó qualquer da árvore.

Por que tem de ser `<html>` e não uma `div` de embrulho: uma `div` com
`data-theme` carrega o atributo mas não pinta nada — se ela não tiver caixa
própria (`display: contents`, ou simplesmente sem `bg-`), o que aparece por
trás é o que `:root` resolveu para `body`, que é a raiz do documento. Era
exatamente esse o defeito da versão anterior: seis ecrãs embrulhavam o
conteúdo em `<div data-theme="light" className="contents">`, e num sistema com
o SO em escuro isso pintava texto quase preto sobre fundo quase preto — o
"contraste bugado" que a dona relatou tinha essa causa concreta, não era
impressão. Um atributo em `<html>` não tem essa ambiguidade: é a raiz, resolve
uma vez, para a árvore inteira.

**"Sistema" é o único caso em que o servidor não sabe de antemão** — ele não
vê a preferência do sistema operativo de quem pediu a página. Por isso o
cookie não guarda só a escolha, guarda-a já resolvida
(`sistema-claro` / `sistema-escuro`): o controlo do lado do cliente
([`components/tema/seletor-tema.tsx`](apps/web/src/components/tema/seletor-tema.tsx))
resolve por `matchMedia`, aplica na hora (`document.documentElement.dataset.theme`,
sem `router.refresh()`), ouve a mudança do sistema, e regrava o cookie sempre
que ela muda — o servidor fica no máximo um passo atrás, nunca errado por
muito tempo, e certo já na visita seguinte.

### O controlo

O seletor é de três estados — Sistema / Claro / Escuro — e mora no
`OperateTopbar`, ao lado do nome e do "sair". A barra aparece nos seis layouts
da operação e da gestão, então um controlo só cobre toda a área da dona; sobre
tinta, usa os tokens `--on-ink*` que a barra já redefine.

### As três áreas

O sistema continua a ter três áreas com temperaturas diferentes de propósito,
mas as três agora atravessam os dois temas — nenhuma força mais um lado.

**Área da cliente** (`/agendar/…`) — fotografia, ar, escala grande. É venda.
O fluxo é unidade → serviços → horário → confirmar → **selo**.

**Área de trabalho** (`/`, `/agenda`, `/avisos`, `/caixa`, `/clientes`) —
densa, sóbria, sem foto decorativa. É a receção de pé no tablet, sob luz de
salão. Barra de tinta no topo, colunas estreitas, números tabulares.

**Área de gestão** (`/admin`) — a mesma sobriedade, mas sentada e mensal em vez
de em pé e diária: mais ar, tipografia maior, cartão de métrica em faixa,
listas de resumo em vez de formulário justo. É onde a dona lê o mês e decide
o que é estrutural — unidade, catálogo, equipa, comissão.

`lang="pt-PT"` na raiz e Bodoni só em títulos ≥28px continuam a valer nas três
áreas por igual, nos dois temas.

Vocabulário partilhado entre as três — mudou num sítio, muda em todos:

- **A pastilha de horário** (`h-14`, `rounded-plate`, borda sutil, afunda 1px ao
  clicar) é idêntica em `/agendar/…/horarios`, `/agenda/…/encaixe` e
  `/agenda/…/remarcar/…`.
- **O navegador de dia** — `[←] quarta-feira, 5 de agosto [→]` — é o mesmo nos
  três ecrãs em que se anda no calendário.
- **Selecionado é tinta** em todo o sistema. Não há um segundo idioma de seleção.

## 8. A grade do dia

[`components/agenda/day-grid.tsx`](apps/web/src/components/agenda/day-grid.tsx)
é o ecrã mais denso do produto e o que mais decisões carrega.

- **Estado é peso de tinta, não uma cor por estado.** Cinco pastéis obrigariam a
  receção a decorar uma legenda para ler a própria manhã. Aqui o bloco ganha
  peso conforme a cliente avança: marcado é leve, chegou ganha o banho de
  bronze, **em atendimento é o único bloco maciço do ecrã**, concluído afunda
  para o tom da régua e sai do caminho.
- **A coluna tem teto** (`18rem`). Com `1fr` e duas profissionais escaladas, um
  corte de cabelo passava a ser uma faixa de meio ecrã.
- **O cabeçalho tem a medida da grade**, calculada da mesma fórmula
  (`3.5rem + 18rem × colunas`), e a ficha da cliente encosta na grade em vez de
  ir para a outra ponta do ecrã.
- **A linha do agora** só aparece no dia que está a correr. Em qualquer outra
  data seria mentira.
- **A confirmação enviada é um ponto, não um sexto estado.** Se a cliente já
  recebeu recado é outra pergunta sobre o mesmo bloco, e a escala de tinta está
  cheia — um sexto tom obrigava a decorar aquilo que a escala existe para evitar.
  É um ponto de 6px em `--estado-bom` à cabeça da linha, na grade e na lista
  ([`marca-confirmacao.tsx`](apps/web/src/components/agenda/marca-confirmacao.tsx)),
  que se conta de relance sem disputar a leitura do estado. Some de `checked_in`
  em diante: a partir daí a cliente está na loja e a pergunta deixou de existir.

## 9. Imagem

Unidades e serviços têm `image_url`, e a unidade tem ainda uma **galeria**
(`unit_photos`) com ordem e texto alternativo próprios. O upload é real
([`components/admin/image-field.tsx`](apps/web/src/components/admin/image-field.tsx)
e [`components/admin/gallery.tsx`](apps/web/src/components/admin/gallery.tsx)),
com costura de storage plugável; em produção o driver ativo grava no bucket
`imagens` do Railway e serve por `/api/imagens/[...key]`.

**Sem foto não é buraco.** `Photo` cai numa placa de tinta com o monograma
(`components/ui/photo.tsx`), que é um estado desenhado, não uma falha.

**A capa é sempre paisagem.** O herói é uma banda larga: retrato entra na galeria,
nunca na capa. É por isso que a capa da Maia é a bancada de lavatórios e não o
retrato dos espelhos suspensos, que é a fotografia mais bonita das nove.

> ✅ **As 9 fotografias das duas lojas são reais** — a dona mandou, estão em
> `material/fotos/` e entraram no banco pelo `packages/db/src/cadastro/nohora.ts`.
> Vieram por WhatsApp, comprimidas a 1600 px: publicam, mas os originais valem ser
> pedidos.
>
> ⚠️ **As 7 fotografias de serviço continuam ilustrativas** (Unsplash) e existem
> para o desenho ter matéria. A lista de reposição está na secção 12.

## 10. A montra

A montra (`/loja` e `/loja/[unidade]`) é a única parte do sistema que não serve
para fazer nada — serve para a pessoa decidir se quer. Depois da reunião com os
sócios ganhou vocabulário próprio, e este é o registo dele.

**Uma barra colada, e só uma.** Na página da casa, quem cola é o índice de
secções ([`components/vitrine/indice.tsx`](apps/web/src/components/vitrine/indice.tsx));
o cabeçalho rola para fora como conteúdo. Duas barras coladas acopla-lhes as
alturas — cada `scroll-mt` da página passa a depender de as duas continuarem
com a altura que tinham no dia em que foram medidas, e ninguém volta a mexer numa
sem partir a outra. A secção activa marca-se com a régua de bronze, o mesmo gesto
que já marca a loja activa nos separadores. Sem JavaScript continuam a ser
âncoras que funcionam.

**Um separador só existe se a secção existir.** O índice nomeia o que a página
realmente desenhou — uma casa sem ensaio fotográfico não ganha um "A casa" que
salta para lado nenhum. Quando a decisão é a mesma em dois sítios (o índice e a
própria secção), é uma função só, chamada nos dois.

**Preçário: grupos com a mesma lista fundem-se numa tabela.**
[`lib/precario.ts`](apps/web/src/lib/precario.ts) junta grupos **vizinhos** cujos
serviços coincidem em nome e ordem, e só esses — uma sobreposição parcial deixava
buracos, e um travessão numa coluna de preços lê-se como grátis ou como erro. O
título fundido sai das palavras comuns aos nomes dos grupos ("Cabelo curto" +
"Cabelo comprido" → "Cabelo", colunas "Curto" e "Comprido"): **sem palavra comum
não há fusão**, porque não havia nome honesto para o bloco. Isto é uma dependência
real do que a dona escreve no catálogo, e é de propósito — o dia em que os nomes
deixarem de rimar, os blocos voltam a ser dois sozinhos, sem ninguém mexer em
código.

**O preçário é uma folha, e é a única da montra.** A secção assenta numa faixa
de `--surface-raised` de bordo a bordo, com fio em cima e em baixo — o cartão que
fica no balcão, pousado no bege da página. Não é cartão dentro de cartão nem
grade de cartões: é uma folha, uma vez, para a secção inteira, e é o que torna o
preçário um objecto em vez de mais uma vista da casa. A tarja alternada da tabela
comparada é o `--surface` da página a aparecer por baixo da folha — o contraste
já existia no par de superfícies e não houve cor nova nenhuma a inventar.

**Nome e preço unem-se por pontilhado, não por fio horizontal.**
`.leader-dots` em [`globals.css`](apps/web/src/app/globals.css). Cinquenta e oito
`border-b` empilhados não se leem como lista, leem-se como parede — foi a queixa
literal do cliente ("cansativa", "muita coisa"). O pontilhado corre no sentido da
leitura em vez de a cortar, é o gesto de um menu impresso, e acende a bronze na
fileira sob o cursor. Pontos por `radial-gradient` e nunca `border: dotted`, que
desenha quadrados e desaparece a 1x. É `aria-hidden`: um leitor de ecrã anunciaria
um ponto por cada 7px.

**Preço redondo escreve-se sem cêntimos, e o símbolo é voz quieta.**
`partesDoPreco` em [`lib/format.ts`](apps/web/src/lib/format.ts) devolve número e
símbolo separados e larga o `,00` **só quando os cêntimos são zero** — não é o
`formatMoneyShort`, que arredonda e publicaria 13 € onde o salão cobra 12,50 €.
O símbolo sai a `--text-muted` e a 0.85em, para os algarismos ficarem sozinhos a
desenhar a coluna que a cliente percorre.

**As colunas do preçário reparte-as o código, não o `columns` do CSS.**
`repartirEmColunas` em [`lib/precario.ts`](apps/web/src/lib/precario.ts). `columns`
só equilibra o que pode cortar, e `break-inside-avoid` é obrigatório aqui — meia
lista de "Mãos e pés" numa coluna e metade na outra faria ler o mesmo título duas
vezes. Sem poder cortar, o motor desiste e despeja tudo o que couber na primeira:
era o buraco branco de meia página no fundo à esquerda. O guloso preserva a ordem
do papel dentro de cada coluna, que é como se lê um menu de duas colunas.

**O índice do preçário são pastilhas em fila, não uma grade de fios.** Com o
desenho das linhas de preço, o índice lia-se como mais uma tabela e não se
percebia que era para clicar; e cinco categorias numa grade de três deixavam a
célula órfã. A fila quebra sozinha e não tem órfãos. Continua a ser `<a href="#">`
e nada mais: funciona sem JavaScript e imprime como sumário.

**A tabela comparada continua a ser uma `<dl>`**, com um `<dt>` por serviço e um
`<dd>` por preço — não uma `<table>` que houvesse que desmontar no telemóvel.
Cada preço traz o rótulo da coluna dentro da célula; a partir de `sm` o rótulo
passa a `sr-only` e **nunca a `hidden`**, porque `display:none` tira-o da árvore
de acessibilidade e um leitor de ecrã passaria a ouvir "Brushing, 15 €, 20 €" sem
saber qual é qual. A fila de cabeçalhos por cima é `aria-hidden`: é decoração
para quem vê.

**Ampliar fotografia é um `<dialog>` nativo dentro de um `<a href>`.** O `<a>`
aponta ao ficheiro, e é o que resta sem JavaScript ou em Safari antigo: o
visualizador do navegador, que é uma caixa de luz a sério. Com JavaScript o
clique é interceptado — excepto com modificador, que é um pedido de "abre noutro
separador" e pertence ao navegador — e abre o `<dialog>`, que traz de graça o
`Esc`, o foco preso, o fundo inerte e a devolução do foco. O que o `<dialog>`
**não** traz é travar a rolagem por trás: isso é `body:has(dialog[open])` em CSS,
não JavaScript.

**A legenda escrita à mão vive na ampliação, não na grade.** As descrições do
`alt` são boas e longas; seis delas por baixo das fotografias são mais de cem
palavras de prosa numa página que o cliente já chamou cansativa. Na grade vê-se a
sala; a legenda aparece a quem pediu para ver aquela fotografia.

**A língua troca-se onde se lê, e diz o próprio nome.** O seletor mora no cabeçalho e no
rodapé da montra — PT / EN / ES em texto, nunca bandeiras: bandeira é país, e há mais
espanhol fora de Espanha do que dentro. Não aparece em ecrã nenhum da equipa, porque a oficina
não se traduz. Por dentro é o gémeo do seletor de tema: grava o cookie e mais nada. A diferença
é uma linha — o tema é só CSS e resolve-se no browser, a língua é texto que veio do servidor,
portanto o seletor chama `router.refresh()` e deixa o servidor voltar a escrever a página.

## 11. O que este sistema recusa

Regras de rejeição, não de estilo. Se estiver prestes a escrever uma delas,
reescreva o elemento com outra estrutura.

- **Sobrolho em caixa alta acima de cada secção.** É o andaime que todo o gerador
  de ecrãs desenha por reflexo. `.label-caps` só existe colado a um valor.
- **Marcador numerado (01 / 02 / 03) como andaime.** O número ganha-se quando a
  secção *é* uma sequência.
- **Faixa colorida na borda esquerda** de placa, item de lista ou alerta.
- **Texto em gradiente.** Ênfase é peso ou tamanho.
- **Vidro fosco decorativo.**
- **Grade de cartões idênticos** — ícone + título + parágrafo, repetido.
- **Cartão como resposta padrão.** Agrupar com fio, `divide-y` ou espaço vem
  antes. Cartão dentro de cartão é sempre erro. Era exatamente o defeito do
  `Section` antigo em [`components/admin/shell.tsx`](apps/web/src/components/admin/shell.tsx):
  ele próprio era `surface rounded-card p-6` — uma caixa — e lá dentro as
  tabelas eram outra vez `surface rounded-card`, dois fios paralelos a 24px de
  distância sem nada a separar. `Section` agora é só título + régua de bronze
  + conteúdo; a placa pertence ao objeto (tabela, lista), nunca ao invólucro.
- **Alias de cor legado.** A ponte para a paleta antiga (`wine-*`, `gold-*`,
  `cream-*`) foi removida depois da migração: alias que sobrevive passa a ser a porta
  por onde a paleta velha volta sem ninguém notar.

## 12. Pendências que dependem do cliente

Estão listadas aqui porque são bloqueios de conteúdo, não de código.

1. **Logo vetorizada.** Hoje existe `material/logo.jpg` (raster, fundo branco).
   Falta: **SVG com fundo transparente** + **variante monocromática clara** para
   as superfícies de tinta.
2. **Fotografia real de serviço** para as 7 imagens ilustrativas que restam
   (Corte feminino, Escova, Hidratação, Limpeza de pele, Manicure,
   Mechas / luzes, Progressiva). As de unidade já foram resolvidas com o material
   da dona. Ressalva que sobrevive: **uma das fotos de banco mostra a marca
   "KEVIN.MURPHY" legível na prateleira** — sugere uma parceria de retalho que o
   salão não declarou.
3. **Originais das fotos das lojas.** As nove que temos passaram pela compressão
   do WhatsApp (1600 px, 110–235 KB). Pedir por e-mail ou Drive; reenviar por
   WhatsApp comprime outra vez.
4. **Horário de funcionamento das duas lojas** e **duração real de cada serviço**.
   Sem os horários a agenda não abre nenhum turno; as durações hoje no banco são
   estimativas nossas, marcadas como tais em `packages/db/src/cadastro/precario.ts`.
5. **Confirmação de que os preços do talão impresso estão em vigor.**
6. **O vídeo do Instagram da Maia.** A loja tem poucas fotografias boas e um vídeo
   bem produzido; falta o link do post para decidir como exibir.

---

*Última revisão: 13 de agosto de 2026.*
