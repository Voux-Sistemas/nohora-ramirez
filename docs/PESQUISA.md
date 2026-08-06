# Pesquisa — Como funcionam os sistemas de salão/estúdio de beleza

Levantamento feito a partir de Booksy, Fresha, Trinks, Avec, Meevo, Zenoti, Mindbody e Perceny.
Objetivo: entender modelo, features e logística antes de projetar o nosso.

---

## 1. Os dois modelos de mercado

Existem duas famílias de produto, e elas resolvem problemas diferentes. Quase todo mundo confunde.

### A) Marketplace + Agendamento (Booksy, Fresha)
O produto vende **descoberta de clientes**. O salão vira um "perfil" dentro de um app de consumidor com milhões de usuários; o cliente busca "manicure perto de mim" e acha você.

- Booksy: marketplace com 35M+ consumidores, foco em captação e recompra. Plano pago a partir de US$ 29,99/mês por usuário.
- Fresha: se posiciona primeiro como sistema de gestão, descoberta é benefício secundário. Plano gratuito + cobrança sobre transação (~1,29% + €0,20).
- Ambos: microsite de agendamento, botão de "Agendar" no Instagram/Facebook/Google, widget copiar-e-colar para o site, lembretes automáticos, maquininha própria / Tap to Pay, depósito antecipado contra no-show, marketing (aniversário, campanhas), relatórios em tempo real.

**Trade-off:** você ganha tráfego, mas paga taxa, entrega a marca e o dado do cliente à plataforma, e concorre com o salão da esquina dentro do mesmo app.

### B) ERP de salão / gestão operacional (Trinks, Avec, Meevo, Zenoti)
O produto vende **operação**: agenda, comanda, caixa, comissão, estoque, financeiro, fiscal, multi-unidade.

- Trinks: gestão centralizada de rede, transferência de estoque entre unidades, comissão automatizada com repasse via Pix, emissão de NF para profissional parceiro, app do colaborador, **130+ relatórios** (financeiro, agendamento, comissão, desempenho por unidade, estoque), terminal de autoatendimento/check-in, app white-label da marca, clube de assinaturas.
- Avec: mesma pegada — controle centralizado de agenda/finanças/estoque/equipe, gestão de franquias, comissões, NF.

**Trade-off:** resolve o negócio de verdade, mas não traz cliente novo — o tráfego é seu (Instagram, indicação, Google).

### Onde o nosso projeto se encaixa
Estúdio próprio com **3 unidades** → o que interessa é a **família B com a camada de agendamento da família A sob a sua marca**. Ou seja: ERP de operação multi-unidade + app/PWA de agendamento white-label. Sem marketplace, sem taxa de terceiro, dado do cliente 100% seu.

---

## 2. Glossário operacional (o vocabulário do negócio)

Estes são os conceitos que precisam existir no sistema. Cada um vira entidade ou regra.

| Conceito | O que é | Por que importa no software |
|---|---|---|
| **Unidade** | Cada uma das 3 lojas | Horário, equipe, estoque, caixa e preço podem ser diferentes por unidade |
| **Profissional** | Quem executa | Tem matriz de habilidades (quais serviços faz), escala própria, regra de comissão, pode atuar em mais de uma unidade |
| **Serviço** | Item do catálogo | Duração, preço, categoria, se aceita agendamento online, se exige sinal, se exige anamnese, qual recurso consome |
| **Duração composta** | Aplicação → **processamento** → finalização | Em química/coloração o profissional fica livre durante o processamento. Sistema bom libera a agenda dele nesse intervalo (gap booking) |
| **Buffer** | Folga entre atendimentos | Limpeza, troca de sala, higienização. Ex.: 15 min entre colorações |
| **Recurso** | Cadeira, cabine, lavatório, equipamento | Um agendamento reserva profissional **e** recurso. Agenda genérica não vê isso e gera conflito de sala |
| **Encaixe** | Cliente colocado fora da grade | Precisa de override manual com registro de quem autorizou |
| **Lista de espera** | Fila para horário lotado | Quando alguém cancela, o sistema oferece a vaga automaticamente |
| **Comanda** | Ficha aberta da visita | Acumula serviços executados, profissional de cada item, produtos vendidos, descontos. Fecha no caixa gerando pagamento + comissão |
| **Caixa** | Sessão de operação financeira | Abertura, sangria, suprimento, fechamento, conferência por forma de pagamento |
| **Comissão** | Repasse ao profissional | % por serviço/produto, variável por profissional, com ou sem desconto de material e de taxa de cartão; fechamento por período |
| **Pacote / sessões** | Cliente compra 10, usa aos poucos | Controle de saldo, validade, consumo por atendimento |
| **Assinatura / clube** | Mensalidade com benefícios | Cobrança recorrente + regras de uso |
| **Fidelidade** | Pontos ou cashback | Acúmulo e resgate na comanda |
| **Anamnese / ficha técnica** | Formulário clínico-estético | Alergias, histórico químico, contraindicação, consentimento. Fotos antes/depois. **Dado sensível → LGPD** |
| **Sinal / pré-pagamento** | Valor pago para segurar o horário | Reduz no-show; exige política de cancelamento e regra de reembolso |
| **No-show** | Cliente que não apareceu | Métrica-chave; alimenta bloqueio de reincidente e cobrança de taxa |
| **Estoque** | Revenda + consumo interno | Baixa automática por serviço (ex.: 1 tubo de tinta por coloração), estoque mínimo, inventário, **transferência entre unidades** |
| **Ocupação de cadeira** | % da agenda preenchida | O KPI mais importante da operação |
| **Ticket médio** | Receita / atendimentos | Mede upsell e venda de produto |
| **Taxa de retorno** | % que volta em X dias | Mede saúde do relacionamento |

---

## 3. Como funciona o fluxo do cliente (ponta a ponta)

```
Descoberta (Instagram/Google/link)
   → Escolhe unidade (ou "a mais perto")
   → Monta carrinho de serviços (pode ser mais de um)
   → Escolhe profissional (ou "sem preferência")
   → Vê horários reais disponíveis        ← motor de disponibilidade
   → Cadastro/login (telefone + OTP)
   → Confirma (+ sinal via Pix, se a regra exigir)
   → Recebe confirmação                    ← WhatsApp/e-mail/push
   → Lembrete 24h antes + no dia           ← reduz no-show de 26% a 50%
   → Check-in na unidade
   → Atendimento (comanda aberta)
   → Pagamento (comanda fechada no caixa)
   → Avaliação pós-atendimento
   → Convite de reagendamento / retorno
```

Regras de negócio que sempre aparecem nesse fluxo:
- Antecedência mínima para agendar (ex.: 2h) e máxima (ex.: 60 dias)
- Janela de cancelamento sem multa (ex.: até 24h antes)
- Limite de agendamentos futuros simultâneos por cliente
- Bloqueio/exigência de sinal para cliente com histórico de no-show
- Serviços que só podem ser marcados após avaliação presencial

---

## 4. O motor de disponibilidade — o coração do sistema

É o que separa um sistema de salão de um Google Calendar. Ele responde: *"quais horários existem para este serviço, nesta unidade, com este profissional?"*

**Entradas:**
1. Horário de funcionamento da unidade por dia da semana + exceções (feriado, evento)
2. Escala do profissional + folgas, férias, bloqueios pontuais
3. Agendamentos já existentes (dele e dos recursos)
4. Perfil de duração do serviço: aplicação / processamento / finalização
5. Buffer antes e depois
6. Disponibilidade do recurso (cabine, lavatório, equipamento)
7. Granularidade da grade (5, 10 ou 15 min)
8. Regras de antecedência

**Lógica:**
- Monta a lista de intervalos ocupados por profissional e por recurso
- Desliza uma janela do tamanho total do serviço na granularidade escolhida
- Valida que os **segmentos ativos** (aplicação + finalização) cabem no tempo livre do profissional
- Valida que o **recurso** está livre durante o serviço inteiro, inclusive no processamento
- Durante o processamento o profissional é liberado → o mesmo slot pode receber um segundo cliente rápido (gap booking / double booking controlado)

**Cuidado crítico:** dois clientes confirmando o mesmo horário ao mesmo tempo. A reserva precisa ser transacional com trava (constraint de exclusão por intervalo no Postgres ou advisory lock). Sem isso, overbooking é questão de tempo.

---

## 5. Comunicação e chat

- **Lembretes:** cadência que funciona = confirmação imediata + 24h antes + no dia. WhatsApp é o canal com maior taxa de leitura no Brasil.
- **Custo (WhatsApp Cloud API, Brasil, modelo por mensagem vigente desde 2026):** template de categoria *utility* (lembrete/confirmação) é gratuito dentro da janela de atendimento de 24h e sai por volta de R$ 0,03 fora dela. Marketing custa mais caro. Para 3 unidades isso é irrelevante no orçamento — vale usar a API oficial.
- **Regra da janela de 24h:** depois de 24h sem resposta do cliente, só é possível iniciar conversa por *template* aprovado. Isso molda o design do chat.
- **Chat com o estúdio:** o pedido do cliente aqui é quase sempre "mandar foto de referência de cabelo" e "tirar dúvida antes de marcar". Então o chat precisa de anexo de imagem, contexto do agendamento na conversa e respostas rápidas.
- **Caixa de entrada unificada:** o ideal é que a mensagem que chega pelo WhatsApp caia na mesma tela do chat interno do app, para a recepção não trabalhar em dois lugares.

---

## 6. O que aprendi que costuma faltar nos sistemas prontos

Pontos onde um sistema próprio ganha:

1. **Multi-unidade de verdade** — a maioria trata filial como conta separada. Queremos visão consolidada + operação isolada.
2. **Preço e duração por profissional** — o júnior e o sênior não cobram nem demoram o mesmo. Poucos sistemas modelam isso bem.
3. **Processamento/gap booking** — muitos ignoram e a cadeira fica ociosa 40 minutos por coloração.
4. **Consumo interno de estoque por serviço** — sem isso não existe custo real por atendimento nem margem por serviço.
5. **Comissão com regra composta** — desconto de material, desconto de taxa de cartão, faixas por meta. É onde nasce o atrito com a equipe.
6. **Chat integrado ao histórico do cliente** — conversa solta no WhatsApp pessoal do salão é perda de informação e risco de LGPD.

---

## Fontes

- [Booksy — What is Booksy and How it Works](https://biz.booksy.com/lp/how-it-works)
- [Booksy — Salon Software Features](https://biz.booksy.com/en-us/blog/from-chaos-to-control-salon-software-features-that-simplify-your-life)
- [Fresha vs Booksy — comparativo](https://calendesk.com/compare/booksy-vs-fresha)
- [Fresha — software para salão](https://www.fresha.com/for-business/salon)
- [Trinks — recursos para redes multi-unidade](https://negocios.trinks.com/solucoes/para-expandir-sem-limites/)
- [Trinks — agenda, estoque e financeiro](https://negocios.trinks.com/negocios/saloes-de-beleza/)
- [Avec — sistema para salões](https://negocios.avec.app/)
- [Perceny — booking, waitlist e processing time](https://www.perceny.com/features/booking)
- [Zenoti — guia de salon scheduling software](https://www.zenoti.com/thecheckin/salon-scheduling-software-guide)
- [Mindbody — booking & scheduling para salões](https://www.mindbodyonline.com/business/education/blog/booking-scheduling-salon)
- [Preço WhatsApp Business API Brasil 2026](https://www.socialhub.pro/blog/preco-whatsapp-api-2026-brasil/)
- [Mensagens de agendamento no WhatsApp e redução de no-show](https://blog.organizabot.com/2026/04/mensagens-whatsapp-agendamento.html)
