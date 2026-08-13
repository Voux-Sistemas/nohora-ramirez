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

## 7. Assinaturas por área

O sistema tem duas áreas com temperaturas diferentes de propósito.

**Área da cliente** (`/agendar/…`) — fotografia, ar, escala grande. É venda.
O fluxo é unidade → serviços → horário → confirmar → **selo**.

**Área de operação** (`/`, `/agenda`, `/caixa`, `/clientes`, `/admin`) — densa,
sóbria, sem foto decorativa. É trabalho. Barra de tinta no topo, colunas
estreitas, números tabulares.

Vocabulário compartilhado entre as duas — mudou num lugar, muda nos três:

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

Unidades e serviços têm `image_url`. O upload é real
([`components/admin/image-field.tsx`](apps/web/src/components/admin/image-field.tsx)),
com costura de storage plugável — a decisão de onde hospedar em produção está em
aberto e foi deixada para o cliente.

**Sem foto não é buraco.** `Photo` cai numa placa de tinta com o monograma
(`components/ui/photo.tsx`), que é um estado desenhado, não uma falha.

> ⚠️ **As 10 fotografias hoje no banco são ilustrativas** (Unsplash) e existem
> para o desenho ter matéria. Nenhuma é do salão. A lista de reposição está na
> seção 11.

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
  antes. Cartão dentro de cartão é sempre erro.
- **Alias de cor legado.** A ponte para a paleta antiga (`wine-*`, `gold-*`,
  `cream-*`) foi removida depois da migração: alias que sobrevive vira porta dos
  fundos para a paleta velha voltar sem ninguém notar.

## 11. Pendências que dependem do cliente

Estão listadas aqui porque são bloqueios de conteúdo, não de código.

1. **Logo vetorizada.** Hoje existe `material/logo.jpg` (raster, fundo branco).
   Falta: **SVG com fundo transparente** + **variante monocromática clara** para
   as superfícies de tinta.
2. **Fotografia real do salão** para as 10 imagens ilustrativas — 3 unidades
   (Centro, Jardins, Moema) e 7 serviços (Corte feminino, Escova, Hidratação,
   Limpeza de pele, Manicure, Mechas / luzes, Progressiva). Duas ressalvas
   específicas:
   - **Moema está em preto e branco** enquanto Centro e Jardins estão em cor. A
     rede não parece a mesma rede.
   - **A foto de Centro mostra a marca "KEVIN.MURPHY" legível na prateleira** —
     ela sugere uma parceria de varejo que o salão não declarou.
3. **Onde hospedar as imagens em produção.** O upload funciona e a costura é
   plugável; falta escolher o destino.

---

*Última revisão: 5 de agosto de 2026.*
