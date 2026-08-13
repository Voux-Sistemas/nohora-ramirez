# Product

<!-- impeccable:product-schema 1 -->

Detalhe completo de personas e funcionalidades vive em [docs/PRODUTO.md](docs/PRODUTO.md);
decisões técnicas com data e motivo em [docs/DECISOES.md](docs/DECISOES.md). Este arquivo
guarda só a verdade durável que o trabalho de design precisa e não pode inventar.

## Platform

web

## Users

Quatro papéis confirmados, em duas famílias que não compartilham contexto de uso. **Não existe
papel de recepcionista** — decisão do dono do produto: quem atende ao balcão entra como
gerente ou como profissional, e a cena de balcão continua existindo sem login próprio.

- **Cliente do salão** (cena: celular, à noite, fora do horário comercial). Marca sozinha,
  escolhe unidade + serviço + profissional favorita, quer ver preço e duração antes de
  confirmar, quer mandar foto de referência. Não quer ligar. Meta de produto: agendar em < 60s.
- **Profissional** (celular, entre atendimentos). Agenda do dia, ficha do cliente antes de
  começar, extrato de comissão em tempo real — este último é o item que mais gera confiança.
- **Gerente de unidade** (desktop, e tablet em pé no balcão com cliente esperando na frente).
  Ocupação, faturamento, escala, estoque da unidade — e a tela de agenda, onde precisa de
  velocidade acima de tudo.
- **Dona / rede** (desktop). Painel consolidado das unidades, comissão da rede, catálogo
  e regras padronizados.

A profissional enxerga **só a própria agenda** — sem as colunas das colegas. Também decisão do
dono do produto.

## Product Purpose

Plataforma própria de agendamento e gestão para estúdio de beleza multi-unidade: o cliente
marca sozinho, a recepção opera comanda e caixa na mesma tela, o profissional vê comissão em
tempo real e a dona enxerga as unidades num painel só.

Sucesso, conforme `docs/PRODUTO.md` §6: ≥60% dos agendamentos feitos pelo próprio cliente,
queda ≥30% no no-show, fechamento de comissão de horas para <15 min.

## Positioning

**Não é marketplace.** Não disputa tráfego com outros salões e não cobra taxa por
agendamento. O tráfego vem do Instagram, do Google e da indicação; o sistema converte, retém
e organiza sob a marca do próprio estúdio. White-label é a posição, não um extra.

Mecanismo que um concorrente não copia sem refazer o núcleo: motor de disponibilidade que
reserva recurso físico (cabine, lavatório, equipamento) junto com pessoa, e preço/duração
variáveis por profissional e por unidade.

## Operating Context

- O primeiro cliente real, **NOHORA RAMIREZ — Beauty Studio, tem 2 unidades** (Valongo e Maia)
  e fica em **Portugal**, distrito do Porto. Cliente único com histórico consolidado entre elas.
- **Moeda e idioma são variáveis, não constantes** (`apps/web/src/lib/pais.ts`): para este
  cliente é euro, português europeu e fuso `Europe/Lisbon`; o ambiente de demonstração continua
  em pt-BR e BRL. Todo valor monetário é **inteiro em centavos**.
- Vocabulário do que a cliente lê segue o país: *preçário, brushing, maquilhagem, verniz,
  telemóvel, morada*. As telas de operação ainda estão no registro pt-BR — passagem pendente.
- Cada unidade tem seu próprio fuso horário no schema.
- O balcão opera de pé, sob luz de salão, com o cliente presente. A cliente final opera no
  celular, sozinha, muitas vezes fora do horário comercial.
- **ADR-008 (decisão do dono do produto):** isto é um produto para vender a salões, não uma
  ferramenta para um único estúdio. O estúdio fictício do seed é o **ambiente de demonstração
  comercial** e precisa ser realista — é o que se mostra numa venda.

## Capabilities and Constraints

Construído e funcionando: agendamento do cliente (unidade → serviço → horário → confirmar),
agenda da recepção com encaixe e remarcação, comanda, caixa, clientes com importação CSV,
comissões, cadastros de admin (unidades, serviços, equipe, recursos), login por OTP para
cliente e por senha para equipe.

Restrições e fatos que o design não pode contrariar:

- Duração e buffers antes/depois são por serviço; preço e duração têm exceção por
  profissional e por unidade (`resolvePrice`, precedência staff+unit → staff → unit → base).
  A duração é **um número só** — o salão informa o tempo total com a cliente. O schema ainda
  guarda `setup/processing/finish` porque o motor de agenda foi escrito assim, mas o produto
  escreve tudo em `setup` e zera o resto: nenhuma tela oferece encaixe no processamento.
- Alguns serviços exigem anamnese ou avaliação presencial antes de poderem ser marcados.
- Sinal antecipado existe como percentual (pontos-base) ou valor fixo.
- Estados do agendamento: agendado → confirmado → check-in → em atendimento → concluído /
  cancelado / no-show.

Sobre imagem, no estado em que está hoje:

- `services.image_url`, `units.image_url` e `staff_profiles.avatar_url` são populados e lidos
  pelas telas. Onde não há foto, o componente `Photo` desenha a placa com monograma — e essa
  é a saída normal, não um erro a corrigir com foto de banco.
- Cada unidade tem, além da capa, uma **galeria** (`unit_photos`) com ordem e texto
  alternativo próprios, editável em `/admin/unidades/[id]`.
- O upload real existe e está em produção: `apps/web/src/server/storage/`, com a costura
  `imageStore()` isolando o driver. **O driver ativo é `s3`**, gravando no bucket `imagens` do
  Railway e servindo por `/api/imagens/[...key]` — é o único lugar com backup. O volume
  `UPLOAD_DIR` continua montado mas não é usado.
- **As fotos das duas lojas são reais**, mandadas pela dona e versionadas em `material/fotos/`.
  Chegaram por WhatsApp, então estão comprimidas a 1600 px — publicam bem, mas os originais
  ainda precisam ser pedidos por e-mail ou Drive.
- **A fotografia de serviço continua ilustrativa** e precisa ser substituída antes de qualquer
  uso comercial. Ver a lista na seção 9 do DESIGN.md.

## Brand Commitments

**Nome confirmado: NOHORA RAMIREZ — Beauty Studio.** Já substituiu o nome de trabalho
`Studio Lumine` em todo o produto, no banco e no projeto de produção (`salao-producao`).

Logo entregue pelo usuário em `material/logo.jpg` (raster, 640×640, fundo branco). Elementos da
identidade, observados do arquivo:

- **Monograma NR** em serifa de altíssimo contraste (didone/moderna), com modulação grossa-fina
  acentuada e um **swash calígráfico longo** que nasce no N, atravessa por baixo do R e rompe
  o círculo. Esse gesto é o elemento mais distintivo da marca.
- **Coroa botânica** circular de traço muito fino: ramos de folhas pequenas, desenho aberto
  no ponto onde o swash passa.
- **Wordmark** `NOHORA RAMIREZ` em serifa caixa-alta com hairlines finas, e
  `BEAUTY STUDIO` em caixa-alta com tracking largo.
- **Monocromática: preto sobre branco. Não há cor de marca a herdar.** A paleta é decisão de
  design, não herança.

Consequências que o trabalho de design precisa respeitar:

- O nome próprio é o posicionamento. Em beleza de alto padrão, o nome da dona comunica
  autoria pessoal — "estas mãos". A identidade não deve diluir isso em marca corporativa.
- O arquivo é JPG com fundo branco: **precisa ser vetorizado (SVG) com fundo transparente**
  antes de ir para produção, e precisa de variante monocromática clara para fundo escuro.
  Item da lista de substituição entregue ao usuário.
- White-label continua sendo compromisso de produto (README): o sistema roda sob a marca do
  estúdio cliente, então cor, logo e imagem são **variáveis de tema**, nunca valores
  codificados. Nohora Ramirez é o primeiro vestido dessa estrutura, não a estrutura.
- Voz do produto em pt-BR, direta, sem jargão de software. Os comentários do código já
  seguem isso.

**Direção visual escolhida pelo usuário: o padrão da categoria, executado com fidelidade
total.** Numa rodada de direções (2026-08-04) o usuário viu propostas fora do padrão e
escolheu deliberadamente a convenção do setor: fundo neutro quente, serifa de alto contraste
como voz de display, fotografia real, acento metálico quente, geometria macia. Isso é
compromisso registrado, não acaso — trabalho futuro não deve "corrigir" essa escolha nem
contrabandear conceito por baixo dela.

O usuário delegou a régua de qualidade com a instrução de surpreender dentro desse tom.
Régua assumida: **Mangomint e Boulevard** (acabamento dentro da própria categoria),
**Resy e Tock** (o análogo direto: escolher pessoa, horário e lugar com fotografia real) e
disciplina de fotografia de hospitalidade de alto padrão, onde a imagem faz trabalho
estrutural e não decorativo.

Mundo fixado não significa a versão mais mansa do mundo: a paleta sai do material real do
salão de alto padrão (pedra quente, tinta quase preta, bronze), não do creme lavado com
dourado brilhante que é o rendering automático dessa categoria.

## Evidence on Hand

- `docs/` — pesquisa de concorrentes (Booksy, Fresha, Trinks, Avec), modelo de dados,
  arquitetura, roadmap e ADRs. Material real, escrito para este projeto.
- `dados/*.csv` — 9 arquivos que definem o **formato de importação** do onboarding
  (unidades, horários, profissionais, escalas, serviços, matriz de habilidades, recursos,
  exceções de preço, comissões). Por ADR-008 são referência de formato, não dado de cliente.
- `packages/db/src/seed/` — estúdio fictício completo. É o ambiente de demonstração.
- `material/` — o que a dona **de fato** mandou: as nove fotografias das duas lojas, o
  preçário impresso (`precario.pdf`) e o logo. É a única fonte de dado real de cliente no
  repositório, e `material/LEIA-ME.md` explica a convenção. Transcrito em
  `packages/db/src/cadastro/precario.ts` e aplicado por `cadastro/nohora.ts`.

O que **não** existe e não pode ser fabricado: clientes reais, depoimentos, números de
resultado, preço de licença do software, prazo de implantação, e qualquer imagem de salão que
não esteja em `material/`. Fotografia de demonstração é ilustrativa e precisa ser rotulada
como tal na lista de substituição entregue ao usuário.

**A duração de cada serviço no banco é estimativa nossa, não dado da dona.** O talão impresso
só traz preço. Está marcado no cabeçalho de `precario.ts` e na lista de conferência entregue
ao usuário — nenhuma tela deve apresentar esses minutos como se viessem do salão.

## Product Principles

1. **A velocidade da recepção é sagrada.** Nenhuma escolha visual pode custar um clique ou
   um segundo em quem opera de pé com cliente esperando.
2. **A vitrine e a oficina são cenas diferentes.** A tela da cliente pode e deve ser
   sedutora; a tela de quem trabalha é ferramenta. O mesmo mundo visual serve às duas, com
   densidade e temperatura diferentes.
3. **O sistema veste a marca do estúdio, não a própria.** Tudo que for identidade precisa
   ser variável, não constante.
4. **Dinheiro e horário não admitem ambiguidade.** Valor em centavos, número tabular, estado
   do agendamento sempre explícito.
5. **A demonstração é o produto na hora da venda.** Tela sem dado realista é tela que não
   vende.

## Accessibility & Inclusion

- Alvo de toque grande: a recepção toca a tela com a mão ocupada ou molhada.
- Foco visível é obrigatório — a recepção navega no teclado (já implementado em
  `globals.css`).
- Campo de formulário com fonte ≥16px para não disparar zoom automático no iOS.
- Contraste precisa se sustentar sob a luz forte de salão, não só no monitor do desenvolvedor.
