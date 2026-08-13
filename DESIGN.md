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

## 7. As duas áreas, e o mapa

O sistema tinha oito entradas de topo — `/`, `/agendar`, `/loja`, `/conta`,
`/agenda`, `/caixa`, `/clientes`, `/admin` — cada uma com casca própria, marca
própria e uma tela de "escolha a unidade" antes de mostrar seja o que for.
Quem chegava pelo Instagram caía no painel de faturamento da recepção; quem
trocava de seção no balcão voltava ao começo. **Hoje são duas áreas e duas
cascas.**

### A área da cliente — quatro telas

| Rota | O que é |
|---|---|
| `/` | A página. Capa em sangria, as casas, o preçário da rede. |
| `/casa/[slug]` | A casa. Morada, horário, ensaio fotográfico, preçário dela. |
| `/marcar` | **A marcação inteira, numa tela.** Casa → serviços → com quem → quando → confirmar, com estado próprio e o extrato sempre à vista. Termina no **selo**. |
| `/minha-conta` | O que está por vir e o que já foi. Cancelar e marcar outra. |

A casca é [`app/(site)/layout.tsx`](apps/web/src/app/(site)/layout.tsx) —
cabeçalho de tinta com as quatro portas, rodapé com a morada de cada casa. A
marcação fica **fora** dela de propósito: é um fluxo com princípio e fim, e uma
barra de navegação a meio seria um convite a sair. É a área que segue o tema do
sistema operativo: à noite, no telemóvel da cliente, pode escurecer.

### A área da equipa — uma casca, seis secções

[`components/shell/painel-shell.tsx`](apps/web/src/components/shell/painel-shell.tsx) —
barra lateral de tinta a partir de `lg`, barra de topo com rolagem horizontal
abaixo disso.

| Rota | O que é |
|---|---|
| `/painel` | **Hoje.** A grade do dia da casa, uma coluna por profissional. |
| `/painel/agenda` | **A agenda de uma pessoa, em dia · semana · mês.** |
| `/painel/clientes` | A carteira da rede. |
| `/painel/caixa` | A gaveta da casa. |
| `/painel/avisos` | A fila de mensagens. |
| `/painel/gestao/…` | Casas, catálogo, equipa, recursos, comissões. |

**A casa é estado do painel, não do endereço.** Escolhe-se uma vez no selector
da barra, mora num cookie
([`server/painel/contexto.ts`](apps/web/src/server/painel/contexto.ts)) e vale
para agenda, caixa, clientes e avisos. Era o que obrigava a três telas de
escolha por turno — e o que fazia sair da agenda do Valongo e cair no índice do
caixa, sem loja nenhuma.

O painel tem o claro forçado (`data-theme="light"` na casca, que o
`globals.css` lê como se fosse `:root`) **mesmo com o sistema em modo escuro**.
O escuro é a temperatura da cliente à noite; quem trabalha aqui está de dia, no
balcão ou à mesa, e a informação — preço, caixa, comissão — precisa de ler-se
sem ambiguidade nenhuma. `lang="pt-PT"` na raiz e Bodoni só em títulos ≥28px
continuam a valer nas duas áreas por igual.

### Vocabulário compartilhado — mudou num lugar, muda em todos

- **A pastilha de horário** (`h-14`, `rounded-plate`, borda subtil, afunda 1px
  ao clicar) é idêntica em `/marcar`, `/painel/encaixe` e `/painel/remarcar/…`.
- **O navegador de período** — `[Dia|Semana|Mês]` mais `[←] rótulo [→]` mais
  "Hoje" — é o mesmo nas telas em que se anda no calendário. "Hoje" só aparece
  quando já não é hoje: um botão que não faz nada ensina a ignorar a barra.
- **Seleccionado é tinta** em todo o sistema. Não há um segundo idioma de
  selecção.
- **O selector nativo** (`<select>`) para casa e para pessoa: no tablet do
  balcão o menu do sistema tem alvos grandes e funciona com a mão ocupada.

## 8. As duas leituras do tempo

O produto lê o tempo de duas maneiras, e elas respondem a perguntas diferentes.
Confundi-las foi o que fez a profissional abrir a grade da recepção sete vezes
para saber como estava a semana dela.

### A grade do dia — o eixo é a casa

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

### A agenda da pessoa — o eixo é quem atende

[`components/painel/minha-agenda.tsx`](apps/web/src/components/painel/minha-agenda.tsx).
Três escalas, três perguntas:

- **Dia** — "o que faço a seguir?". Linha do tempo, hora à esquerda em coluna
  fixa e tabular, nome da cliente em corpo grande. É o ecrã que fica aberto no
  telemóvel entre atendimentos.
- **Semana** — "quando é que tenho um buraco?". Sete colunas curtas: o que se
  lê é a *forma* da semana. No telemóvel empilha, porque uma coluna de 50px não
  mostra nome de cliente nenhum e a semana ali serve para percorrer.
- **Mês** — "como está a correr o mês?". Grade de calendário, seis semanas
  sempre (altura fixa: uma grade que encolhe faz o botão fugir do dedo ao mudar
  de mês), e cada dia mostra **peso** — número de visitas e valor —, nunca uma
  lista de nomes truncados a meio.

Quem gere escolhe de quem é a agenda pelo selector de pessoa. É a resposta à
pergunta que a dona faz em voz alta — "o que é que a Juliana tem na quinta?" —
sem abrir a grade de um dia de cada vez à procura de uma coluna.

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
  antes. Cartão dentro de cartão é sempre erro.
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

*Última revisão: 5 de agosto de 2026.*
