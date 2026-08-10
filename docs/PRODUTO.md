# Produto — Escopo, personas e funcionalidades

Sistema próprio de gestão e agendamento para estúdio de beleza com **3 unidades**.
Nome de trabalho: **Studio** (a definir).

---

## 1. Visão

> Uma plataforma única onde o cliente marca, conversa e paga pela marca do estúdio — e onde a dona enxerga as 3 unidades em uma tela só, com agenda cheia, comissão fechada sem planilha e estoque sob controle.

**Não é** um marketplace. Não vamos disputar tráfego com outros salões. O tráfego vem do Instagram, do Google e da indicação — o sistema converte, retém e organiza.

---

## 2. Personas e o que cada uma precisa

### 👤 Cliente (Camila, 32, cliente recorrente)
Quer marcar às 23h do domingo sem falar com ninguém, com a profissional que ela gosta, na unidade perto do trabalho. Quer mandar foto da referência antes. Odeia ligar.
- Agendar em ≤ 60 segundos, sem baixar app (PWA)
- Escolher unidade + serviço + profissional favorita
- Ver preço e duração antes de confirmar
- Remarcar/cancelar sozinha dentro da política
- Histórico do que já fez, com fotos antes/depois
- Chat direto com o estúdio
- Saldo de pacote e pontos de fidelidade visíveis

### ✂️ Profissional (Juliana, cabeleireira)
Quer saber quantos clientes tem hoje e quanto vai receber no fim do mês, sem depender da recepção.
- Agenda do dia no celular, com nome, serviço e observação do cliente
- Ficha e histórico do cliente antes de começar
- Marcar início/fim do atendimento
- Bloquear horário (almoço, curso, folga)
- **Extrato de comissão em tempo real** — o item que mais gera confiança
- Metas e desempenho

### 🧑‍💼 Recepção / Atendente
Vive na tela de agenda. Precisa de velocidade.
- Agenda multicoluna por profissional, drag & drop, encaixe
- Cadastro rápido de cliente
- Abrir/fechar comanda, lançar produto, aplicar desconto
- Caixa: abertura, sangria, fechamento
- Responder chat/WhatsApp
- Lista de espera e preenchimento de buraco na agenda

### 🏪 Gerente de unidade
- Ocupação, faturamento e ranking da unidade
- Escala da equipe
- Estoque da unidade, pedido de reposição
- Aprovar desconto acima do limite

### 👑 Dona / Rede
- Painel consolidado das 3 unidades e comparativo entre elas
- Faturamento, ticket médio, ocupação, no-show, novos vs. recorrentes
- Fechamento de comissão de toda a rede
- Preço e catálogo padronizados (com exceção por unidade)
- Transferência de estoque entre unidades
- Configuração de regras e permissões

---

## 3. Módulos do sistema

```
┌─────────────────────────────────────────────────────────────┐
│  APP DO CLIENTE (PWA)                                       │
│  agendar · histórico · pacotes · fidelidade · chat · avaliar│
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  PAINEL OPERACIONAL (recepção / profissional / gerente)      │
│  agenda · comanda · caixa · clientes · chat · estoque        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  PAINEL DA REDE (dona)                                       │
│  BI · comissão · financeiro · catálogo · regras · usuários   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  NÚCLEO                                                      │
│  Motor de disponibilidade · Notificações · Pagamentos ·      │
│  Chat/Realtime · Auditoria · Relatórios                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Funcionalidades detalhadas

### 4.1 Agendamento (núcleo)
- [ ] Catálogo de serviços por categoria, com foto e descrição
- [ ] Duração do serviço (um número: o tempo total com a cliente)
- [ ] Buffer configurável antes/depois por serviço
- [ ] Preço e duração **variáveis por profissional e por unidade**
- [ ] Matriz de habilidades (quem faz o quê)
- [ ] Carrinho de múltiplos serviços em sequência na mesma visita
- [ ] Escolha de profissional ou "sem preferência" (sistema distribui)
- [ ] Motor de disponibilidade com recursos (cabine, lavatório, equipamento)
- [ ] Regras: antecedência mín./máx., janela de cancelamento, limite de agendamentos futuros
- [ ] Reserva transacional com trava anti-overbooking
- [ ] Agenda multicoluna por profissional com drag & drop e redimensionar
- [ ] Encaixe manual com registro de autorização
- [ ] Bloqueios: folga, férias, almoço, curso, feriado, manutenção
- [ ] Lista de espera com oferta automática quando abre vaga
- [ ] Agendamento recorrente (ex.: manutenção a cada 4 semanas)
- [ ] Estados: agendado → confirmado → check-in → em atendimento → concluído / cancelado / no-show
- [ ] Histórico de alterações de cada agendamento (quem mudou o quê)

### 4.2 Clientes e ficha
- [ ] Cadastro com telefone como identificador principal
- [ ] Cliente único na rede, com histórico das 3 unidades
- [ ] Observações internas (não visíveis ao cliente)
- [ ] Ficha de anamnese digital configurável por serviço
- [ ] Histórico técnico (fórmula de cor, produto usado, tempo de pausa)
- [ ] Galeria antes/depois com consentimento de uso de imagem
- [ ] Preferências (bebida, profissional favorita, alergia)
- [ ] Tags e segmentos (VIP, inativo, aniversariante do mês)
- [ ] Score de no-show

### 4.3 Comanda e caixa
- [ ] Abrir comanda no check-in
- [ ] Lançar serviços executados (com profissional por item)
- [ ] Lançar produtos de revenda (baixa de estoque)
- [ ] Desconto com alçada por perfil
- [ ] Gorjeta por profissional
- [ ] Pagamento dividido em várias formas (Pix + cartão + saldo de pacote)
- [ ] Consumo de sessão de pacote / crédito
- [ ] Resgate de fidelidade
- [ ] Fechamento com geração de comissões
- [ ] Sessão de caixa: abertura, sangria, suprimento, fechamento com conferência
- [ ] Estorno e cancelamento com trilha de auditoria

### 4.4 Comissão e equipe
- [ ] Regra por profissional, por serviço e por produto
- [ ] % ou valor fixo, com faixas por meta
- [ ] Desconto de custo de material e/ou taxa de cartão (configurável)
- [ ] Extrato do profissional em tempo real no celular
- [ ] Fechamento por período com relatório de repasse
- [ ] Escala de trabalho por unidade
- [ ] Metas individuais e por unidade

### 4.5 Pagamentos
- [ ] Sinal antecipado via Pix na confirmação do agendamento
- [ ] Política de no-show: cobrança de taxa / retenção do sinal
- [ ] Link de pagamento
- [ ] Registro de formas de pagamento presenciais (maquininha externa)
- [ ] Pacotes e créditos pré-pagos
- [ ] Assinatura/clube com cobrança recorrente *(fase posterior)*

### 4.6 Chat e comunicação
- [ ] Chat cliente ↔ unidade, em tempo real
- [ ] Anexo de imagem (foto de referência) e áudio
- [ ] Contexto do agendamento dentro da conversa
- [ ] Respostas rápidas para a recepção
- [ ] Chat interno entre a equipe (por unidade e por rede)
- [ ] Notificações push (PWA) e badge de não lidas
- [ ] Integração WhatsApp Cloud API na mesma caixa de entrada
- [ ] Templates aprovados: confirmação, lembrete 24h, lembrete no dia, pós-atendimento, reativação, aniversário
- [ ] Cadência automática de lembretes com confirmação por 1 clique

### 4.7 Fidelidade, pacotes e marketing
- [ ] Pacotes de sessões com saldo e validade
- [ ] Pontos ou cashback
- [ ] Cupons e promoções (inclusive por horário ocioso)
- [ ] Campanha de reativação (não vem há X dias)
- [ ] Aniversariantes
- [ ] Avaliação pós-atendimento (nota + comentário) e NPS
- [ ] Programa de indicação

### 4.8 Estoque
- [ ] Produtos de revenda e de consumo interno
- [ ] Estoque por unidade
- [ ] Baixa automática por serviço (ficha técnica de consumo)
- [ ] Estoque mínimo e alerta de reposição
- [ ] Entrada por nota de compra, fornecedores
- [ ] **Transferência entre unidades** com aceite
- [ ] Inventário/contagem com ajuste justificado

### 4.9 Financeiro e relatórios
- [ ] Contas a pagar e a receber
- [ ] Fluxo de caixa e conciliação de maquininha
- [ ] Custo por atendimento e margem por serviço
- [ ] DRE simplificado por unidade e consolidado
- [ ] Dashboard: faturamento, ocupação de cadeira, ticket médio, no-show, retorno, novos vs. recorrentes
- [ ] Ranking de profissionais e de serviços
- [ ] Comparativo entre as 3 unidades
- [ ] Exportação CSV/Excel de tudo

### 4.10 Plataforma
- [ ] Papéis e permissões granulares
- [ ] Log de auditoria (quem fez o quê, quando)
- [ ] LGPD: consentimento, exportação e exclusão de dados do titular
- [ ] Backup automatizado e restauração testada
- [ ] Multi-unidade com dado isolado por unidade e visão consolidada
- [ ] Preparado para virar multi-tenant (se um dia virar produto para vender)

---

## 5. Fora de escopo (decisão consciente)

| Item | Por quê |
|---|---|
| Marketplace público de salões | Não é o negócio; custo de aquisição altíssimo |
| App nativo iOS/Android na v1 | PWA resolve; nativo só se push/experiência exigirem |
| Emissão fiscal (NFS-e/NFC-e) na v1 | 3 municípios possivelmente diferentes = complexidade alta. Entra via provedor (Focus/PlugNotas) numa fase posterior |
| Folha de pagamento / eSocial | Contabilidade externa resolve |
| Integração com maquininha física | Registrar a forma de pagamento manualmente já atende no início |

---

## 6. Critérios de sucesso

| Métrica | Meta em 90 dias de uso |
|---|---|
| % de agendamentos feitos pelo cliente (self-service) | ≥ 60% |
| Taxa de no-show | queda ≥ 30% vs. hoje |
| Ocupação de cadeira | +10 p.p. |
| Tempo de fechamento de comissão | de horas para < 15 min |
| Tempo médio para agendar (cliente) | < 60 s |
| Divergência de estoque no inventário | < 3% |
