# O que está feito e o que falta

O sistema está **em produção**, com o NOHORA RAMIREZ — Beauty Studio a operar duas lojas
(Valongo e Maia). Isto não é um plano de fases: é o estado real, lido das rotas que existem em
`apps/web/src/app/` e das tabelas em `packages/db/src/schema/`.

A ordem de construção que nos trouxe aqui está no ADR-008: produto primeiro, em cima de um
estúdio fictício completo, para haver ecrã para mostrar antes de haver cliente; onboarding
depois; notificações por último. Continua a valer.

---

## Está construído e a correr

**A cliente marca sozinha.** `/agendar` leva-a de loja → serviços → profissional e hora →
confirmar → pronto, sem conta nenhuma pelo meio. Vê o preço e a duração antes de confirmar, e a
escolha de profissional vem antes da escolha do dia porque é assim que a decisão acontece. Cada
loja tem ainda a sua montra em `/loja/[unidade]`, com galeria de fotografias.

**O motor de disponibilidade.** Vive em `packages/core`, reserva recurso físico junto com
pessoa, respeita escala, ausência, feriado, buffers e as regras de antecedência de cada loja, e
sabe distribuir entre profissionais quando a cliente não tem preferência. É a parte mais testada
do sistema — 35 casos — e a que tem a única garantia a sério contra marcação dupla: duas
constraints `EXCLUDE` no Postgres, conferidas pelo nome a cada deploy.

**A operação do balcão.** `/` abre com a pauta do dia das duas lojas. `/agenda/[unidade]` é a
agenda multicoluna, com encaixe (`/encaixe`) e remarcação (`/remarcar/[id]`). O fecho é
`/comanda/[id]` — serviços executados, desconto, pagamento repartido por vários métodos — e o
dinheiro do dia é `/caixa/[unidade]`, com abertura, reforço, sangria e fecho conferido contra o
esperado.

**A comissão fecha sozinha.** As regras têm precedência por profissional e serviço; a entrada é
gerada por item no fecho da comanda, com percentagem e base congeladas, e `/admin/comissoes`
mostra o apuramento. Recalcular sobre o histórico é impossível de propósito.

**A ficha da cliente.** `/clientes` com pesquisa, ficha em `/clientes/[id]` com histórico e
notas internas, cadastro à mão em `/clientes/novo` e importação de carteira por CSV em
`/clientes/importar`.

**Os avisos.** `/avisos/[unidade]` é a fila de quem falta contactar hoje, com o texto pronto e o
link que abre a conversa no WhatsApp do salão. Cinco rotinas: confirmação, lembrete da véspera,
lembrete de hoje, pedido de avaliação e resgate.

**A área da dona.** `/` com painel de faturação e marcações por loja e comparativo de mês; e
`/admin` com o registo de unidades, serviços, comissões e equipa — incluindo horário de
funcionamento, feriados, escalas, matriz de habilidades, exceções de preço e galeria de
fotografias por loja.

**A entrada.** Equipa por telefone e palavra-passe, com recuperação por e-mail; cliente por código de
seis dígitos. A primeira conta do sistema nasce em `/comecar` e a porta fecha-se sozinha
depois — o mecanismo está em `ops/README.md`. Quatro degraus de permissão, resolvidos no
servidor.

**A infraestrutura.** Banco no Supabase (Frankfurt), site no Railway (Amesterdão), deploy por
push na branch `producao`, migrations e travas aplicadas antes de trocar a versão. Backup diário
para bucket próprio, com prova de restauro. Fotografias no bucket `imagens`, que é o único sítio
com cópia.

**O país não é constante.** Moeda, locale, fuso e formato de telemóvel saem de `PAIS`
(`apps/web/src/lib/pais.ts`). Para este cliente: euro, `pt-PT`, `Europe/Lisbon`, nove dígitos.

---

## Falta, e sabe-se porquê

### A área da cliente não tem canal a sério em produção

É a pendência que mais se nota. A cliente entra com o telefone e recebe um código por e-mail,
mas o canal só liga com `RESEND_API_KEY` e `EMAIL_REMETENTE` preenchidas, e isso exige um
domínio próprio verificado no Resend — sem ele o e-mail cai no spam. Enquanto não estiver,
`/conta/entrar` **não mostra formulário nenhum**: diz que a área está em preparação e manda falar
com o salão, o que é preferível a uma espera por uma mensagem que nunca chega.

Falta também o segundo problema, que o domínio não resolve: **quem não tem e-mail na ficha não
consegue entrar de todo.** Quem marcou pelo site tem, porque o formulário pede; quem foi
registada ao balcão pode não ter. E não há SMS — não há fornecedor ligado, e o telemóvel é
justamente o identificador que toda a gente tem.

Os passos para abrir estão em `ops/README.md`. Não há passo de código.

### Não há "próximo dia com vaga" na marcação

O ecrã de horários varre catorze dias e pré-seleciona o primeiro com vaga, e quando os catorze
estão cheios ele diz isso e tira o seletor de dia da frente. Mas **dentro** do fluxo, uma vez
escolhido um dia, quem calha num dia sem nada vê o dia vazio e tem de tentar outro à mão.

Havia uma função para isto — `findNextAvailableDay`, em `server/scheduling/availability.ts` — e
foi removida por não ter consumidor nenhum. A pendência é o ecrã, não o cálculo: a saída certa
para um dia vazio é oferecer o próximo dia que serve, não deixar a cliente adivinhar.

### Lista de espera desenhada e nunca usada

`waitlist_entries` existe no banco, com estado e prazo de oferta. Nenhum ecrã escreve nela e
nada oferece a vaga quando alguém cancela. Hoje, cancelamento é buraco na agenda.

### Sem cobrança à distância (ADR-010)

O sinal antecipado está modelado — `requires_deposit`, `deposit_type`, `deposit_value`,
`deposit_paid_at` — e não fala com banco nenhum: marcar "exige sinal" só quer dizer que a
receção sabe que tem de o pedir. O Asaas e o Pix saíram do plano por serem brasileiros, e
nenhum substituto europeu foi escolhido porque nada no salão está à espera disso.

O `pix` **já não aparece no balcão**: `metodosDoPais()` tira-o quando `PAIS` não é `BR`. No
enum do banco ele fica, de propósito — uma comanda fechada com Pix no Brasil tem de continuar
a ler-se "Pix" para sempre, e apagar um valor de enum que o histórico referencia é perder
registo. A lista de métodos é decisão de país; o enum é memória.

Sem retenção de sinal, o que resta contra a falta é `no_show_count` e a marca na ficha —
informação para a receção decidir, não cobrança automática.

### Auditoria escreve num sítio só

`audit_logs` está de pé e nada grava nela. O rasto que existe de facto é
`appointment_status_events`, e cobre mudança de estado da marcação e mais nada: preço, comissão
e comanda mudam sem deixar rasto de quem mudou. Para um sistema onde o atrito com a equipa nasce
de números, é a lacuna mais desconfortável.

### Direitos do titular sem ecrã (RGPD)

Exportar e apagar os dados de uma cliente resolve-se hoje à mão, no banco. `consent_records`
está desenhado e versionado, à espera das funcionalidades que o vão exigir a sério — anamnese e
galeria antes/depois, que são dado de categoria especial e também não existem.

### Sem chat, sem stock, sem fidelidade

Nenhum dos três está construído nem tem tabela no banco. O chat foi substituído, na prática,
pelo clique para o WhatsApp do próprio salão, que custa zero e tem uma pessoa do outro lado; a
caixa de entrada unificada do ADR-004 continua a fazer sentido, mas depende de verificação no
Meta Business, que leva cerca de uma semana e precisa de ser aberta com essa antecedência.
Stock, pacotes de sessões, fidelidade e avaliação pós-atendimento estão por decidir se
entram — nenhum foi pedido pelo salão em produção.

### O onboarding ainda não é um ecrã

Os dez CSV em `dados/` definem o formato de importação, e o formato está provado por testes.
Mas só um deles — `10-clientes.csv` — tem ecrã que o leia. Colocar um salão novo a funcionar
continua a passar por script (`packages/db/src/cadastro/`), que foi como o NOHORA RAMIREZ
entrou. O wizard do ADR-008, ponto 3, está por construir.

### Testes: falta o que só banco real prova

135 testes, quase todos de função pura. Não há teste de integração contra banco, e o caso que
mais interessaria é justamente esse: dois pedidos simultâneos no mesmo horário, um a passar e o
outro a receber o erro tratado. A trava está provada por construção e conferida no deploy, mas
não por um teste que a tente furar. Também não há E2E nem teste de carga.

### Pequenas dívidas conhecidas

O registo de erros em produção não existe — não há Sentry nem equivalente, e o que se sabe de
uma falha é o que o Railway mostra no log. E os dois buckets de ficheiros nasceram em San Jose antes
de o ADR-009 mover o site para Amesterdão, portanto cada fotografia atravessa o Atlântico de ida
e volta — a correção está descrita em `ops/README.md` e é coordenação, não volume. O serviço
`backup` tem o mesmo problema pela mesma razão: corre em US East e o banco está em Frankfurt,
portanto o dump diário atravessa o Atlântico. É uma vez por dia e num banco pequeno, por isso
custa segundos, não minutos — mas move-se junto com os buckets quando isso for feito.

### O papel dono mora no ambiente do site

O ADR-009 pôs o site a ligar-se como `app_web`, um papel que só faz DML, para que uma injeção de
SQL não conseguisse derrubar tabela. Só que o `preDeployCommand` corre migrations no mesmo
serviço, e migrations precisam do dono — portanto a `DIRECT_URL`, com a credencial de dono, está
no ambiente do `web` e é legível por qualquer código que corra lá dentro. O `app_web` continua a
valer contra injeção de SQL, que é o ataque para que foi desenhado, mas não contra execução de
código arbitrário no servidor.

Fechar isto quer dizer tirar as migrations do deploy do site e pô-las num job à parte que seja o
único a ter a credencial de dono. É mais uma peça no projeto, contra a decisão de o manter com
duas — fica para depois do arranque da cliente, e é decisão dela, não dívida escondida.

---

## O que continua a valer como risco

| Risco | Por que continua a doer | O que o segura hoje |
|---|---|---|
| Motor de disponibilidade errado | Cliente marca e não tem vaga: perda de confiança irreversível | 35 testes escritos antes do código, em função pura |
| Marcação dupla por concorrência | Duas clientes na mesma cadeira, descoberto ao balcão | Constraint `EXCLUDE` no banco, conferida pelo nome a cada deploy |
| Comissão divergente | Atrito directo com a equipa | Percentagem e base congeladas na entrada; nunca se recomputa o histórico |
| Seed apontado ao banco do salão | Apaga agenda e registos, sem confirmação e sem volta | `deployment_env` dentro do banco, que viaja com ele |
| Backup que não presta no dia do resgate | No plano Free do Supabase, é a única rede | Restauro provado todas as noites em `ops/backup`, num Postgres virgem, com as 41 tabelas e as 2 travas conferidas. Primeira prova contra o Supabase a 14/08/2026 |
| Volume perdido | Banco íntegro a apontar para fotografias que já não existem | As imagens vivem no bucket, não em disco |
