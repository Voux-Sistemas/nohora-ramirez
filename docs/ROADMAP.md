# Roadmap de execução

Estimativas em semanas de trabalho contínuo com Claude Code. São ordens de grandeza, não promessa.

---

## Fase 0 — Fundação · ~1 semana

Antes de escrever tela, resolver o que só você sabe.

- [ ] **Levantamento real**: catálogo dos serviços das 3 unidades com duração (setup/processamento/finalização), preço e quem faz o quê
- [ ] Horário de funcionamento de cada unidade, escala de cada profissional
- [ ] Regras de comissão vigentes (por profissional, por serviço, com/sem desconto de material)
- [ ] Política de cancelamento, sinal e no-show que você **quer** ter
- [ ] Recursos físicos por unidade (cadeiras, cabines, lavatórios, equipamentos)
- [ ] Decisões técnicas travadas (infra, gateway, chat)
- [ ] Identidade visual: logo, cores, tom
- [ ] Setup: repo, monorepo, Postgres no Railway, CI, ambientes, Sentry

**Entrega:** repositório rodando com "hello world" em staging + planilha de dados reais para o seed.

---

## Fase 1 — MVP de Agendamento · ~4 semanas

O objetivo é simples: **o cliente marca sozinho e a agenda funciona nas 3 unidades**.

**Semana 1** — Schema completo, migrations, seed com dados reais. Autenticação (OTP para cliente, senha para staff). Papéis e permissões. CRUD de unidades, serviços, profissionais, escalas, recursos.

**Semana 2** — Motor de disponibilidade em `packages/core` com suíte de testes escrita antes. Reserva transacional com constraint de exclusão. API de slots.

**Semana 3** — PWA do cliente: escolher unidade → serviços → profissional → horário → confirmar. Cadastro/login. Meus agendamentos, remarcar, cancelar. Painel de agenda multicoluna com drag & drop, encaixe, bloqueios.

**Semana 4** — WhatsApp Cloud API + templates aprovados. Cadência de lembretes no worker. Estados do agendamento e check-in. Ajustes, testes E2E, **piloto em 1 unidade**.

**Critério de pronto:** uma unidade operando 100% pelo sistema por uma semana, sem planilha paralela.

---

## Fase 2 — Operação e dinheiro · ~3 semanas

- Comanda: abrir, lançar serviço/produto, desconto com alçada, gorjeta
- Pagamento dividido em múltiplas formas
- Sessão de caixa: abertura, sangria, suprimento, fechamento com conferência
- Motor de comissão + extrato do profissional no celular + fechamento por período
- Sinal via Pix com webhook, política de no-show
- Lista de espera com oferta automática ao cancelar
- Relatórios operacionais do dia

**Critério de pronto:** um mês fechado com comissão calculada pelo sistema batendo com o cálculo manual.

---

## Fase 3 — Cliente e relacionamento · ~3 semanas

- Chat em tempo real cliente ↔ estúdio, com imagem e áudio
- Caixa de entrada unificada com WhatsApp
- Chat interno da equipe
- Ficha de anamnese configurável + assinatura + consentimento LGPD
- Histórico técnico e galeria antes/depois
- Avaliação pós-atendimento e NPS
- Pacotes de sessões e fidelidade (pontos/cashback)

**Critério de pronto:** cliente resolve tudo dentro do app; recepção não abre mais o WhatsApp pessoal.

---

## Fase 4 — Gestão da rede · ~3 semanas

- Estoque por unidade, consumo interno por serviço, estoque mínimo
- Transferência entre unidades com aceite
- Entrada por nota, fornecedores, inventário
- Financeiro: contas a pagar/receber, fluxo de caixa, conciliação de maquininha
- Custo por atendimento e margem por serviço
- Dashboard da rede: comparativo das 3 unidades, ocupação, ticket médio, no-show, retorno
- Metas por profissional e por unidade
- Exportações

**Critério de pronto:** você decide preço e escala olhando o painel, não o achismo.

---

## Fase 5 — Escala · sob demanda

- Emissão fiscal NFS-e/NFC-e via provedor (Focus NFe / PlugNotas)
- App nativo (Expo) se o push do PWA no iOS limitar
- Marketing automation com segmentação avançada
- Clube de assinatura com recorrência
- Terminal de autoatendimento/check-in na recepção
- Multi-tenant, caso vire produto para vender a outros salões

---

## Ordem de risco — o que atacar primeiro

| Risco | Impacto | Mitigação | Quando |
|---|---|---|---|
| Motor de disponibilidade errado | Cliente marca e não tem vaga → perda de confiança irreversível | Testes antes do código; piloto em 1 unidade | Fase 1 |
| Overbooking por concorrência | Dois clientes no mesmo horário | Constraint de exclusão no banco, não só na aplicação | Fase 1 |
| Equipe não adota | Sistema vira enfeite e volta a planilha | Piloto com 1 unidade, treinar recepção, extrato de comissão como isca de adoção | Fase 1-2 |
| Comissão divergente | Atrito direto com a equipe | Rodar em paralelo com o cálculo manual por 1 mês antes de virar oficial | Fase 2 |
| Template do WhatsApp reprovado | Sem lembrete = no-show alto | Submeter templates cedo, ter e-mail/push como fallback | Fase 1 |
| Migração da base de clientes | Perder histórico | Importador CSV + validação antes do go-live | Fase 1 |
| Escopo inflando | Projeto sem fim | Cada fase tem critério de pronto; nada entra fora de fase | Sempre |

---

## Estratégia de rollout

```
1. Piloto: unidade menor, 2 semanas, agenda em paralelo com o método atual
2. Ajuste com base no atrito real da recepção
3. Unidade 2 e 3 na mesma semana, já com playbook
4. Abrir agendamento online ao cliente só depois que a operação interna estiver estável
5. Divulgar no Instagram com incentivo (ex.: primeiro agendamento pelo app tem brinde)
```

Nunca abrir para o cliente antes da equipe estar confortável. Agenda quebrada na frente do cliente custa mais caro do que duas semanas de atraso.

---

## KPIs de acompanhamento

Painel semanal desde o go-live:

- % de agendamentos self-service (meta ≥ 60% em 90 dias)
- Taxa de no-show (meta: −30%)
- Ocupação de cadeira por unidade (meta: +10 p.p.)
- Ticket médio
- Taxa de retorno em 60 dias
- Tempo de fechamento de comissão (meta < 15 min)
- Nota média de avaliação
- Erros em produção (Sentry) — meta: zero crítico
