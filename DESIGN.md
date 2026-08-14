# DESIGN — NOHORA RAMIREZ, Beauty Studio

Documento do sistema visual. Descreve o que está construído, não o que se
pretende construir. Quem for mexer numa tela lê isto antes.

A fonte da verdade é [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css)
— este arquivo explica as decisões; o CSS as executa. Onde os dois divergirem, o
CSS está certo e este documento está velho.

---

## 1. A cena que decide tudo

> Camila abre o celular às 22h40 de domingo, no escuro do quarto, para ver se
> consegue a Juliana no sábado. Doze horas depois a mesma interface está num
> tablet no balcão, sob LED de salão batendo em espelho e mármore, com uma
> cliente de pé esperando.

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
| `signal-good/warn/bad` | só onde estado é fato do produto | escurecidos até passarem 4.5:1 sobre o fundo rebaixado, o pior caso em que aparecem |

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
justamente na tela em que a recepção precisa dela.

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

`.label-caps` **não é eyebrow de seção.** É rótulo de dado: aparece onde há um
valor logo em seguida (nome da unidade num cartão, "a partir de" num preço),
nunca solto acima de um título.

## 4. Forma, elevação, camada

- **Uma escala de raio só:** `--radius-plate: 4px`. Placa e controle
  compartilham. Pílula é reservada ao que é genuinamente pílula — chip, selo,
  avatar.
- **Placa usa fio, não sombra.** Elevação é rara: barra fixa, diálogo, menu.
- Sombra é sempre **tingida do próprio chão**, nunca preta.
- Camada tem escala nomeada — `--z-sticky` … `--z-tooltip`. Nada de `9999`.

## 5. Movimento

Saída exponencial (`--ease-out-quint`, `--ease-out-expo`). **Sem bounce:** o
produto marca hora e cobra dinheiro.

Não há entrada genérica aplicada a toda seção. O movimento autoral do produto
acontece **uma vez só**: o selo, quando o horário fica marcado. A coroa se
desenha, as folhas abrem atrás dela e o swash atravessa por último — a mesma
ordem em que a mão desenharia.

`prefers-reduced-motion` não é opcional. Quem desligou movimento recebe o selo
**pronto**, não vazio: o conteúdo é o padrão e a animação é o enfeite.

## 6. Marca

[`components/brand/mark.tsx`](apps/web/src/components/brand/mark.tsx) —
`Wreath`, `Monogram`, `Wordmark`.

O gesto distintivo é o **swash**: nasce no N, passa por baixo do R e **rompe o
círculo** da coroa. É intencional e vem da logo original; não é um traço solto.

Derivada gráfica: `.rule-bronze`, o fio que fecha um bloco — vem da coroa
botânica.

## 7. Tema claro/escuro

**O claro é o padrão de todo o produto** — inclusive na área da cliente, que
antes escurecia sozinha seguindo o sistema operacional. Agora ninguém escurece
sem escolher: quem quiser escuro pede, no controlo da barra.

### Mecanismo

O tema vive em `<html data-theme="light" | "dark">`, nunca em `div` nem em
`prefers-color-scheme` sozinho. É decisão de servidor, a partir de um cookie
(`tema`, lido por [`lib/tema.ts`](apps/web/src/lib/tema.ts)): `app/layout.tsx`
é `async`, lê o cookie antes de render, e já entrega o `data-theme` certo no
primeiro HTML. Sem script inline, sem flash, sem divergência de hidratação —
e `color-scheme` finalmente vale para barra de rolagem e controlo nativo,
coisa que só funciona a partir de `<html>`, nunca de um nó qualquer da árvore.

Por que tem de ser `<html>` e não uma `div` de embrulho: uma `div` com
`data-theme` carrega o atributo mas não pinta nada — se ela não tiver caixa
própria (`display: contents`, ou simplesmente sem `bg-`), o que aparece por
trás é o que `:root` resolveu para `body`, que é a raiz do documento. Era
exatamente esse o defeito da versão anterior: seis telas embrulhavam o
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
densa, sóbria, sem foto decorativa. É a recepção de pé no tablet, sob luz de
salão. Barra de tinta no topo, colunas estreitas, números tabulares.

**Área de gestão** (`/admin`) — a mesma sobriedade, mas sentada e mensal em vez
de em pé e diária: mais ar, tipografia maior, cartão de métrica em faixa,
listas de resumo em vez de formulário justo. É onde a dona lê o mês e decide
o que é estrutural — unidade, catálogo, equipe, comissão.

`lang="pt-PT"` na raiz e Bodoni só em títulos ≥28px continuam valendo nas três
áreas por igual, nos dois temas.

Vocabulário compartilhado entre as três — mudou num lugar, muda em todos:

- **A pastilha de horário** (`h-14`, `rounded-plate`, borda sutil, afunda 1px ao
  clicar) é idêntica em `/agendar/…/horarios`, `/agenda/…/encaixe` e
  `/agenda/…/remarcar/…`.
- **O navegador de dia** — `[←] quarta-feira, 5 de agosto [→]` — é o mesmo nas
  três telas em que se anda no calendário.
- **Selecionado é tinta** em todo o sistema. Não há um segundo idioma de seleção.

## 8. A grade do dia

[`components/agenda/day-grid.tsx`](apps/web/src/components/agenda/day-grid.tsx)
é a tela mais densa do produto e a que mais decisões carrega.

- **Estado é peso de tinta, não uma cor por estado.** Cinco pastéis obrigariam a
  recepção a decorar uma legenda para ler a própria manhã. Aqui o bloco ganha
  peso conforme a cliente avança: marcado é leve, chegou ganha o banho de
  bronze, **em atendimento é o único bloco maciço da tela**, concluído afunda
  para o tom da régua e sai do caminho.
- **A coluna tem teto** (`18rem`). Com `1fr` e duas profissionais escaladas, um
  corte de cabelo virava uma faixa de meia tela.
- **O cabeçalho tem a medida da grade**, calculada da mesma fórmula
  (`3.5rem + 18rem × colunas`), e a ficha da cliente encosta na grade em vez de
  ir para a outra ponta da tela.
- **A linha do agora** só aparece no dia que está correndo. Em qualquer outra
  data seria mentira.

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
> para o desenho ter matéria. A lista de reposição está na seção 11.

## 10. O que este sistema recusa

Regras de rejeição, não de estilo. Se você está prestes a escrever uma delas,
reescreva o elemento com outra estrutura.

- **Sobrolho em caixa alta acima de cada seção.** É o andaime que todo gerador
  de tela desenha por reflexo. `.label-caps` só existe colado a um valor.
- **Marcador numerado (01 / 02 / 03) como andaime.** Número se ganha quando a
  seção *é* uma sequência.
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
  `cream-*`) foi removida depois da migração: alias que sobrevive vira porta dos
  fundos para a paleta velha voltar sem ninguém notar.

## 11. Pendências que dependem do cliente

Estão listadas aqui porque são bloqueios de conteúdo, não de código.

1. **Logo vetorizada.** Hoje existe `material/logo.jpg` (raster, fundo branco).
   Falta: **SVG com fundo transparente** + **variante monocromática clara** para
   as superfícies de tinta.
2. **Fotografia real de serviço** para as 7 imagens ilustrativas que restam
   (Corte feminino, Escova, Hidratação, Limpeza de pele, Manicure,
   Mechas / luzes, Progressiva). As de unidade já foram resolvidas com o material
   da dona. Ressalva que sobrevive: **uma das fotos de banco mostra a marca
   "KEVIN.MURPHY" legível na prateleira** — sugere uma parceria de varejo que o
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
