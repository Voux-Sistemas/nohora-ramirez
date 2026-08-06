# Modelo de dados

Postgres. Todas as tabelas com `id` (uuid), `created_at`, `updated_at`, e `deleted_at` quando fizer sentido soft delete.
Toda tabela operacional carrega `unit_id` (ou chega nela via FK) — é o eixo do multi-unidade.

---

## 1. Mapa das entidades

```
Organization (a rede)
 └── Unit (3 unidades)
      ├── UnitHours / UnitException
      ├── Resource (cabine, lavatório, equipamento)
      ├── CashSession → CashMovement
      └── StockItem → StockMovement

User ──┬── StaffProfile ── StaffUnit (n:n com Unit)
       │                 ├── StaffSchedule (escala) / StaffTimeOff (bloqueios)
       │                 ├── StaffSkill (n:n com Service)
       │                 └── CommissionRule
       └── ClientProfile ── ClientNote, AnamnesisResponse, ConsentRecord

ServiceCategory ── Service ──┬── ServicePricing (por unidade e/ou profissional)
                             ├── ServiceResourceReq (n:n com ResourceType)
                             └── ServiceConsumption (n:n com Product)

Appointment ──┬── AppointmentItem (serviço + profissional + recurso + horário)
              ├── AppointmentStatusEvent
              └── Ticket (comanda) ──┬── TicketItem (serviço/produto/pacote)
                                     ├── Payment
                                     └── CommissionEntry

WaitlistEntry · Package · PackagePurchase · PackageSession
LoyaltyAccount · LoyaltyTransaction · Coupon
Conversation ── Message · NotificationLog · MessageTemplate
Review · AuditLog
```

---

## 2. Entidades principais

### Organização e unidades

**`organizations`** — a rede. `name`, `document`, `timezone`, `settings` (jsonb).

**`units`** — `organization_id`, `name`, `slug`, `address`, `lat/lng`, `phone`, `timezone`, `settings` (jsonb: antecedência mín./máx., janela de cancelamento, política de sinal, granularidade da grade).

**`unit_hours`** — `unit_id`, `weekday` (0-6), `opens_at`, `closes_at`. Pode ter mais de uma faixa por dia (intervalo de almoço).

**`unit_exceptions`** — `unit_id`, `date`, `closed` (bool), `opens_at`, `closes_at`, `reason`. Feriados e eventos.

### Pessoas

**`users`** — autenticação. `phone` (único, identificador principal no BR), `email`, `name`, `avatar_url`, `password_hash` (só staff), `status`.

**`roles` / `user_roles`** — `client`, `professional`, `receptionist`, `unit_manager`, `finance`, `owner`. Papel é atribuído **por unidade** (`user_roles.unit_id` nullable = escopo rede).

**`staff_profiles`** — `user_id`, `display_name`, `bio`, `specialties`, `color` (cor na agenda), `accepts_online_booking`, `hire_date`, `status`.

**`staff_units`** — n:n. Um profissional pode atender em mais de uma unidade.

**`staff_schedules`** — escala. `staff_id`, `unit_id`, `weekday`, `starts_at`, `ends_at`, `valid_from`, `valid_to`. Suporta escala rotativa.

**`staff_time_off`** — `staff_id`, `starts_at`, `ends_at`, `type` (folga/férias/almoço/curso/atestado), `note`.

**`client_profiles`** — `user_id`, `birthdate`, `gender`, `how_found_us`, `preferred_unit_id`, `preferred_staff_id`, `tags` (text[]), `no_show_count`, `lifetime_value`, `first_visit_at`, `last_visit_at`.

**`client_notes`** — observações internas, `author_id`, `body`, `pinned`.

### Catálogo

**`service_categories`** — `name`, `order`, `unit_id` nullable (null = rede toda).

**`services`** — `name`, `description`, `category_id`, `image_url`,
`duration_setup_min` (aplicação), `duration_processing_min` (processamento — profissional livre), `duration_finish_min` (finalização),
`buffer_before_min`, `buffer_after_min`,
`base_price`, `online_bookable`, `requires_deposit`, `deposit_type` (percent/fixed), `deposit_value`,
`requires_anamnesis`, `anamnesis_form_id`, `max_per_day`, `active`.

> A duração total = setup + processing + finish + buffers. O profissional só é **ocupado** em setup e finish. O recurso é ocupado do início ao fim.

**`service_pricing`** — override. `service_id`, `unit_id` nullable, `staff_id` nullable, `price`, `duration_override_min`. Resolução: staff+unit > staff > unit > base.

**`staff_skills`** — `staff_id`, `service_id`, `enabled`. Matriz de habilidades.

**`resource_types`** — `name` (cabine, lavatório, secador, laser), `unit_id`.

**`resources`** — instância física. `resource_type_id`, `unit_id`, `name`, `active`.

**`service_resource_requirements`** — `service_id`, `resource_type_id`, `quantity`.

### Agendamento

**`appointments`** — a visita.
`unit_id`, `client_id`, `starts_at`, `ends_at` (envelope de todos os itens), `status`, `source` (app/recepção/whatsapp), `notes`, `created_by`, `deposit_payment_id`, `cancellation_reason`, `cancelled_by`, `rescheduled_from_id`, `recurrence_id`.

`status`: `draft` · `scheduled` · `confirmed` · `checked_in` · `in_progress` · `completed` · `cancelled_by_client` · `cancelled_by_studio` · `no_show`

**`appointment_items`** — um por serviço da visita.
`appointment_id`, `service_id`, `staff_id`, `resource_id`, `starts_at`, `ends_at`,
`staff_busy_ranges` (tstzrange[] — os blocos em que o profissional está de fato ocupado),
`price`, `duration_min`, `order`.

> **Trava anti-overbooking:** constraint de exclusão (`btree_gist`) garantindo que não existam dois `appointment_items` com o mesmo `staff_id` e intervalos ativos sobrepostos, nem dois com o mesmo `resource_id` e intervalos sobrepostos — considerando apenas status não cancelados.

**`appointment_status_events`** — trilha. `appointment_id`, `from_status`, `to_status`, `actor_id`, `reason`, `at`.

**`waitlist_entries`** — `client_id`, `unit_id`, `service_id`, `staff_id` nullable, `desired_from`, `desired_to`, `flexibility`, `status`, `notified_at`.

**`appointment_recurrences`** — `rule` (RRULE), `until`, `client_id`, template do agendamento.

### Comanda, caixa e pagamento

**`tickets`** (comanda) — `unit_id`, `client_id`, `appointment_id` nullable, `number`, `status` (open/closed/cancelled), `opened_by`, `opened_at`, `closed_by`, `closed_at`, `subtotal`, `discount_total`, `tip_total`, `total`, `cash_session_id`.

**`ticket_items`** — `ticket_id`, `type` (service/product/package/fee), `service_id`/`product_id`/`package_id`, `staff_id` (quem executou/vendeu), `quantity`, `unit_price`, `discount`, `total`, `commission_base`.

**`payments`** — `ticket_id` nullable, `appointment_id` nullable (para sinal), `method` (pix/credit/debit/cash/transfer/package_credit/loyalty), `amount`, `installments`, `fee_amount`, `gateway`, `gateway_payment_id`, `status`, `paid_at`, `refunded_at`.

**`cash_sessions`** — `unit_id`, `opened_by`, `opened_at`, `opening_amount`, `closed_by`, `closed_at`, `closing_amount`, `expected_amount`, `difference`, `status`.

**`cash_movements`** — `cash_session_id`, `type` (sale/sangria/suprimento/estorno/despesa), `amount`, `description`, `actor_id`.

### Comissão

**`commission_rules`** — `staff_id` nullable, `service_id` nullable, `product_id` nullable, `category_id` nullable, `unit_id` nullable,
`type` (percent/fixed), `value`, `deduct_material_cost` (bool), `deduct_card_fee` (bool),
`tier_rules` (jsonb — faixas por meta), `priority`, `valid_from`, `valid_to`.
Resolução do mais específico para o mais genérico via `priority`.

**`commission_entries`** — gerada no fechamento da comanda. `ticket_item_id`, `staff_id`, `base_amount`, `rate`, `deductions`, `amount`, `period`, `status` (pending/approved/paid), `paid_at`, `payout_id`.

### Pacotes, fidelidade e cupons

**`packages`** — `name`, `service_id` (ou lista), `sessions_count`, `price`, `validity_days`, `unit_scope`.
**`package_purchases`** — `client_id`, `package_id`, `purchased_at`, `expires_at`, `sessions_remaining`, `ticket_item_id`.
**`package_sessions`** — consumo. `package_purchase_id`, `appointment_item_id`, `used_at`.

**`loyalty_accounts`** — `client_id`, `points_balance`, `cashback_balance`.
**`loyalty_transactions`** — `account_id`, `type` (earn/redeem/expire/adjust), `points`, `amount`, `ref_ticket_id`, `description`.

**`coupons`** — `code`, `type`, `value`, `min_amount`, `valid_from`, `valid_to`, `max_uses`, `uses`, `applies_to` (jsonb), `unit_scope`.

### Estoque

**`suppliers`** — `name`, `document`, `contact`.
**`products`** — `name`, `sku`, `barcode`, `brand`, `category`, `type` (resale/internal/both), `cost_price`, `sale_price`, `unit_of_measure`, `active`.
**`stock_items`** — saldo por unidade. `product_id`, `unit_id`, `quantity`, `min_quantity`, `avg_cost`.
**`stock_movements`** — `stock_item_id`, `type` (in/out/adjust/transfer_out/transfer_in/consumption/sale/loss), `quantity`, `unit_cost`, `ref_type`, `ref_id`, `actor_id`, `note`.
**`stock_transfers`** — `from_unit_id`, `to_unit_id`, `status` (requested/sent/received/cancelled), `requested_by`, `received_by`, `items` (via `stock_transfer_items`).
**`service_consumption`** — ficha técnica. `service_id`, `product_id`, `quantity`. Gera baixa automática ao concluir o atendimento.

### Anamnese e imagens

**`anamnesis_forms`** — `name`, `schema` (jsonb — perguntas configuráveis), `version`, `active`.
**`anamnesis_responses`** — `client_id`, `form_id`, `appointment_id`, `answers` (jsonb), `signed_at`, `signature_url`.
**`client_photos`** — `client_id`, `appointment_id`, `type` (before/after/reference), `url`, `consent_id`.
**`consent_records`** — LGPD. `client_id`, `purpose` (image_use/marketing/data_processing), `granted`, `granted_at`, `revoked_at`, `ip`, `text_version`.

### Comunicação

**`conversations`** — `type` (client_studio/internal), `unit_id`, `client_id` nullable, `title`, `last_message_at`, `status` (open/closed), `assigned_to`.
**`conversation_participants`** — `conversation_id`, `user_id`, `last_read_at`.
**`messages`** — `conversation_id`, `sender_id` nullable, `sender_type` (user/system/whatsapp), `body`, `attachments` (jsonb), `external_id` (id do WhatsApp), `delivered_at`, `read_at`.
**`message_templates`** — `key`, `channel` (whatsapp/email/push), `category` (utility/marketing), `body`, `variables`, `provider_template_id`, `approved`.
**`notification_logs`** — `user_id`, `channel`, `template_key`, `ref_type`, `ref_id`, `status`, `provider_response`, `cost`, `sent_at`.

### Qualidade e auditoria

**`reviews`** — `appointment_id`, `client_id`, `staff_id`, `unit_id`, `rating`, `nps`, `comment`, `published`, `reply`.
**`audit_logs`** — `actor_id`, `action`, `entity_type`, `entity_id`, `before` (jsonb), `after` (jsonb), `ip`, `at`.

---

## 3. Regras de integridade que valem código

1. **Overbooking** — constraint de exclusão por `staff_id` e por `resource_id` sobre intervalos ativos. Nunca confie só na checagem em aplicação.
2. **Fuso horário** — armazenar tudo em `timestamptz` (UTC). Converter na borda usando o timezone **da unidade**, não do servidor nem do navegador.
3. **Preço congelado** — `appointment_items.price` e `ticket_items.unit_price` guardam o valor no momento do evento. Mudar a tabela de preços não pode reescrever o passado.
4. **Comanda fechada é imutável** — alteração só via estorno com registro em `audit_logs`.
5. **Comissão é derivada, mas persistida** — recalcular retroativamente muda o que já foi pago. Gerar `commission_entries` no fechamento e nunca recomputar em cima do histórico.
6. **Cliente é único na rede** — `users.phone` é a chave. Histórico atravessa as 3 unidades.
7. **Soft delete em cliente e agendamento**, hard delete só sob pedido de exclusão LGPD (com anonimização do que precisa ficar por obrigação fiscal).
8. **Estoque nunca fica negativo** sem um movimento de ajuste justificado.
