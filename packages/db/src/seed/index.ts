/**
 * Carga do estúdio fictício.
 *
 *   npm run db:seed
 *
 * Apaga tudo e recria do zero, de forma determinística (ver `rng.ts`). É o
 * ambiente de demonstração do produto e a base dos testes de integração —
 * ADR-008.
 *
 * Se este script falhar com violação de constraint de exclusão, não é o seed
 * que está errado: é o motor de disponibilidade tendo produzido sobreposição.
 * Nesse caso o bug é em `@studio/core`, e o seed acabou de ganhar o dia.
 */

import '../env'
import { isoDateInZone, type PriceOverride } from '@studio/core'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { assertNotProduction } from '../guard'
import { closeDb, getDb } from '../index'
import {
  appointmentItems,
  appointmentResourceBlocks,
  appointments,
  appointmentStaffBlocks,
  appointmentStatusEvents,
  clientNotes,
  clientProfiles,
  organizations,
  resources,
  resourceTypes,
  serviceCategories,
  servicePricing,
  serviceResourceRequirements,
  services,
  staffProfiles,
  staffSchedules,
  staffSkills,
  staffUnits,
  toRange,
  unitHours,
  units,
  userRoles,
  users,
} from '../schema/index'
import {
  ADMINS,
  CATEGORIES,
  CLIENTS,
  ORGANIZATION,
  PRICING_EXCEPTIONS,
  RESOURCES,
  RESOURCE_TYPES,
  SERVICES,
  STAFF,
  UNITS,
} from './data'
import {
  generateAppointments,
  type ResourceCtx,
  type ServiceCtx,
  type StaffCtx,
  type UnitCtx,
} from './appointments'
import { Rng } from './rng'

/** Quantos dias de agenda gerar para trás e para frente a partir de hoje. */
const DAYS_BACK = 28
const DAYS_AHEAD = 35

async function main(): Promise<void> {
  const db = getDb({ max: 1 })
  await assertNotProduction(db, 'seed')
  const rng = new Rng()
  const tz = ORGANIZATION.timezone
  const now = new Date()
  const today = isoDateInZone(now, tz)

  console.log(`→ semeando "${ORGANIZATION.name}" (hoje = ${today}, fuso ${tz})`)

  await wipe(db)

  // ─── organização e unidades ───────────────────────────────────────────────

  const [org] = await db
    .insert(organizations)
    .values({
      name: ORGANIZATION.name,
      slug: ORGANIZATION.slug,
      document: ORGANIZATION.document,
      timezone: tz,
    })
    .returning({ id: organizations.id })
  const orgId = org!.id

  const unitIdBySlug = new Map<string, string>()
  for (const unit of UNITS) {
    const [row] = await db
      .insert(units)
      .values({
        organizationId: orgId,
        name: unit.name,
        slug: unit.slug,
        phone: unit.phone,
        addressLine: unit.addressLine,
        district: unit.district,
        city: unit.city,
        state: unit.state,
        postalCode: unit.postalCode,
        imageUrl: unit.imageUrl,
        timezone: tz,
        settings: unit.settings,
      })
      .returning({ id: units.id })
    unitIdBySlug.set(unit.slug, row!.id)

    await db.insert(unitHours).values(
      unit.hours.map(([weekday, opensAt, closesAt]) => ({
        unitId: row!.id,
        weekday,
        opensAt,
        closesAt,
      })),
    )
  }
  console.log(`  unidades: ${UNITS.length}`)

  // ─── recursos ─────────────────────────────────────────────────────────────

  const resourceTypeIdByName = new Map<string, string>()
  for (const name of RESOURCE_TYPES) {
    const [row] = await db
      .insert(resourceTypes)
      .values({ organizationId: orgId, name })
      .returning({ id: resourceTypes.id })
    resourceTypeIdByName.set(name, row!.id)
  }

  const resourcesByUnit = new Map<string, ResourceCtx[]>()
  for (const [unitSlug, counts] of Object.entries(RESOURCES)) {
    const unitId = unitIdBySlug.get(unitSlug)!
    const created: ResourceCtx[] = []
    for (const [typeName, quantity] of Object.entries(counts)) {
      const resourceTypeId = resourceTypeIdByName.get(typeName)!
      for (let i = 1; i <= (quantity ?? 0); i++) {
        const [row] = await db
          .insert(resources)
          .values({
            unitId,
            resourceTypeId,
            name: `${typeName} ${i}`,
            priority: i,
          })
          .returning({ id: resources.id })
        created.push({ id: row!.id, resourceTypeId })
      }
    }
    resourcesByUnit.set(unitSlug, created)
  }
  console.log(`  recursos: ${[...resourcesByUnit.values()].reduce((n, r) => n + r.length, 0)}`)

  // ─── catálogo ─────────────────────────────────────────────────────────────

  const categoryIdByName = new Map<string, string>()
  for (const [index, name] of CATEGORIES.entries()) {
    const [row] = await db
      .insert(serviceCategories)
      .values({ organizationId: orgId, name, sortOrder: index })
      .returning({ id: serviceCategories.id })
    categoryIdByName.set(name, row!.id)
  }

  const serviceCtxBySlug = new Map<string, ServiceCtx>()
  for (const [index, service] of SERVICES.entries()) {
    const [row] = await db
      .insert(services)
      .values({
        organizationId: orgId,
        categoryId: categoryIdByName.get(service.category)!,
        name: service.name,
        description: service.description ?? null,
        imageUrl: service.imageUrl ?? null,
        basePrice: service.basePrice,
        /* A duração vive em três colunas por causa do motor de agenda, mas o
           produto só oferece um número: tudo na primeira, zero nas outras. */
        setupMin: service.durationMin,
        processingMin: 0,
        finishMin: 0,
        bufferAfterMin: service.bufferAfterMin,
        onlineBookable: service.onlineBookable ?? true,
        requiresDeposit: service.requiresDeposit ?? false,
        depositType: service.depositType ?? null,
        depositValue: service.depositValue ?? null,
        requiresAssessment: service.requiresAssessment ?? false,
        requiresAnamnesis: service.requiresAnamnesis ?? false,
        sortOrder: index,
      })
      .returning({ id: services.id })

    const requiredResourceTypeIds = service.resourceTypes.map(
      (name) => resourceTypeIdByName.get(name)!,
    )
    if (requiredResourceTypeIds.length > 0) {
      await db.insert(serviceResourceRequirements).values(
        requiredResourceTypeIds.map((resourceTypeId) => ({
          serviceId: row!.id,
          resourceTypeId,
        })),
      )
    }

    serviceCtxBySlug.set(service.slug, {
      id: row!.id,
      slug: service.slug,
      basePrice: service.basePrice,
      baseDurationMin: service.durationMin,
      onlineBookable: service.onlineBookable ?? true,
      deposit:
        service.requiresDeposit && service.depositType && service.depositValue
          ? service.depositType === 'percent'
            ? { type: 'percent', bps: service.depositValue }
            : { type: 'fixed', cents: service.depositValue }
          : null,
      spec: {
        serviceId: row!.id,
        duration: {
          setupMin: service.durationMin,
          processingMin: 0,
          finishMin: 0,
          bufferBeforeMin: 0,
          bufferAfterMin: service.bufferAfterMin,
        },
        requiredResourceTypeIds,
      },
    })
  }
  console.log(`  serviços: ${SERVICES.length}`)

  // ─── equipe ───────────────────────────────────────────────────────────────

  const staffCtxBySlug = new Map<string, StaffCtx>()
  for (const person of STAFF) {
    const [user] = await db
      .insert(users)
      .values({ phone: person.phone, email: person.email, name: person.name })
      .returning({ id: users.id })

    const [profile] = await db
      .insert(staffProfiles)
      .values({
        userId: user!.id,
        displayName: person.name.split(' ')[0]!,
        color: person.color,
        acceptsOnlineBooking: person.acceptsOnlineBooking ?? true,
        hiredAt: person.hiredAt,
      })
      .returning({ id: staffProfiles.id })

    await db.insert(staffUnits).values(
      person.units.map((unitSlug, index) => ({
        staffId: profile!.id,
        unitId: unitIdBySlug.get(unitSlug)!,
        isPrimary: index === 0,
      })),
    )

    await db.insert(userRoles).values(
      person.units.map((unitSlug) => ({
        userId: user!.id,
        unitId: unitIdBySlug.get(unitSlug)!,
        role: 'professional' as const,
      })),
    )

    await db.insert(staffSkills).values(
      person.skills.map((slug) => ({
        staffId: profile!.id,
        serviceId: serviceCtxBySlug.get(slug)!.id,
      })),
    )

    const scheduleRows = Object.entries(person.schedule).flatMap(([unitSlug, shifts]) =>
      shifts.map(([weekday, startsAt, endsAt]) => ({
        staffId: profile!.id,
        unitId: unitIdBySlug.get(unitSlug)!,
        weekday,
        startsAt,
        endsAt,
        validFrom: person.hiredAt,
      })),
    )
    if (scheduleRows.length > 0) await db.insert(staffSchedules).values(scheduleRows)

    staffCtxBySlug.set(person.slug, {
      id: profile!.id,
      slug: person.slug,
      units: person.units,
      skills: person.skills,
      acceptsOnlineBooking: person.acceptsOnlineBooking ?? true,
      schedule: person.schedule,
    })
  }
  console.log(`  profissionais: ${STAFF.length}`)

  // ─── administração ────────────────────────────────────────────────────────

  for (const admin of ADMINS) {
    const [user] = await db
      .insert(users)
      .values({ phone: admin.phone, email: admin.email, name: admin.name })
      .returning({ id: users.id })
    await db.insert(userRoles).values({
      userId: user!.id,
      unitId: admin.unit ? unitIdBySlug.get(admin.unit)! : null,
      role: admin.role,
    })
  }
  console.log(`  equipe administrativa: ${ADMINS.length}`)

  // ─── preços de exceção ────────────────────────────────────────────────────

  const priceOverrides: PriceOverride[] = []
  for (const exception of PRICING_EXCEPTIONS) {
    const serviceId = serviceCtxBySlug.get(exception.service)!.id
    const unitId = exception.unit ? unitIdBySlug.get(exception.unit)! : null
    const staffId = exception.staff ? staffCtxBySlug.get(exception.staff)!.id : null
    await db.insert(servicePricing).values({
      serviceId,
      unitId,
      staffId,
      price: exception.price,
      durationOverrideMin: exception.durationOverrideMin ?? null,
    })
    priceOverrides.push({
      serviceId,
      unitId,
      staffId,
      price: exception.price,
      durationOverrideMin: exception.durationOverrideMin ?? null,
    })
  }

  // ─── clientes ─────────────────────────────────────────────────────────────

  const clientCtx: {
    id: string
    userId: string
    preferredUnit?: string
    preferredStaff?: string
  }[] = []

  for (const client of CLIENTS) {
    const [user] = await db
      .insert(users)
      .values({ phone: client.phone, email: client.email ?? null, name: client.name })
      .returning({ id: users.id })

    const [profile] = await db
      .insert(clientProfiles)
      .values({
        userId: user!.id,
        birthdate: client.birthdate ?? null,
        preferredUnitId: client.preferredUnit ? unitIdBySlug.get(client.preferredUnit)! : null,
        preferredStaffId: client.preferredStaff ? staffCtxBySlug.get(client.preferredStaff)!.id : null,
        tags: [...(client.tags ?? [])],
        noShowCount: client.noShowCount ?? 0,
        requiresDeposit: (client.noShowCount ?? 0) >= 2,
      })
      .returning({ id: clientProfiles.id })

    await db.insert(userRoles).values({ userId: user!.id, unitId: null, role: 'client' })

    if (client.note) {
      await db.insert(clientNotes).values({
        clientId: profile!.id,
        body: client.note,
        pinned: true,
      })
    }

    clientCtx.push({
      id: profile!.id,
      userId: user!.id,
      ...(client.preferredUnit ? { preferredUnit: client.preferredUnit } : {}),
      ...(client.preferredStaff ? { preferredStaff: client.preferredStaff } : {}),
    })
  }
  console.log(`  clientes: ${CLIENTS.length}`)

  // ─── agenda ───────────────────────────────────────────────────────────────

  const unitCtx: UnitCtx[] = UNITS.map((unit) => ({
    id: unitIdBySlug.get(unit.slug)!,
    slug: unit.slug,
    timezone: tz,
    hours: unit.hours,
    granularityMin: Number(unit.settings.granularityMin ?? 15),
  }))

  const planned = generateAppointments({
    rng,
    units: unitCtx,
    services: [...serviceCtxBySlug.values()],
    staff: [...staffCtxBySlug.values()],
    resourcesByUnit,
    clients: clientCtx,
    priceOverrides,
    fromDate: shiftIsoDate(today, -DAYS_BACK),
    days: DAYS_BACK + DAYS_AHEAD,
    today,
    now,
  })

  // As linhas são montadas em memória com UUID gerado aqui e gravadas em lote.
  // Inserir uma a uma com `returning` custaria ~4 idas ao banco por visita —
  // sobre um proxy público isso vira dezenas de minutos.
  const serviceById = new Map([...serviceCtxBySlug.values()].map((s) => [s.id, s]))
  const appointmentRows: (typeof appointments.$inferInsert)[] = []
  const itemRows: (typeof appointmentItems.$inferInsert)[] = []
  const staffBlockRows: (typeof appointmentStaffBlocks.$inferInsert)[] = []
  const resourceBlockRows: (typeof appointmentResourceBlocks.$inferInsert)[] = []
  const statusEventRows: (typeof appointmentStatusEvents.$inferInsert)[] = []

  const lastVisitByClient = new Map<string, Date>()
  const firstVisitByClient = new Map<string, Date>()

  for (const visit of planned) {
    const cancelled = !visit.reservesTime
    const appointmentId = randomUUID()

    appointmentRows.push({
      id: appointmentId,
      unitId: visit.unitId,
      clientId: visit.clientId,
      startsAt: visit.slot.start,
      endsAt: visit.slot.end,
      status: visit.status,
      source: visit.source,
      clientNote: visit.clientNote ?? null,
      totalPrice: visit.totalPrice,
      depositRequired: visit.depositRequired,
      depositPaidAt: visit.depositRequired > 0 && !cancelled ? visit.slot.start : null,
      checkedInAt: hasCheckedIn(visit.status) ? visit.slot.start : null,
      startedAt: hasStarted(visit.status) ? visit.slot.start : null,
      completedAt: visit.status === 'completed' ? visit.slot.end : null,
      cancelledAt: cancelled ? new Date(visit.slot.start.getTime() - 7200_000) : null,
      cancellationReason: visit.cancellationReason ?? null,
    })

    statusEventRows.push({
      appointmentId,
      fromStatus: null,
      toStatus: visit.status,
      reason: visit.cancellationReason ?? null,
      occurredAt: visit.slot.start,
    })

    for (const [index, item] of visit.slot.items.entries()) {
      const priced = visit.itemPrices[index]!
      const spec = serviceById.get(item.serviceId)!
      const itemId = randomUUID()

      itemRows.push({
        id: itemId,
        appointmentId,
        serviceId: item.serviceId,
        staffId: item.staffId,
        startsAt: item.start,
        endsAt: item.end,
        price: priced.price,
        durationMin: priced.durationMin,
        durationProfile: {
          setupMin: spec.spec.duration.setupMin,
          processingMin: spec.spec.duration.processingMin,
          finishMin: spec.spec.duration.finishMin,
        },
        sortOrder: index,
      })

      // horário cancelado não reserva nada — bloco existente = horário ocupado
      if (cancelled) continue

      for (const block of item.staffBusy) {
        staffBlockRows.push({
          appointmentItemId: itemId,
          staffId: item.staffId,
          block: toRange(block.start, block.end),
        })
      }

      for (const resourceId of item.resourceIds) {
        resourceBlockRows.push({
          appointmentItemId: itemId,
          resourceId,
          block: toRange(item.resourceBusy.start, item.resourceBusy.end),
        })
      }
    }

    if (visit.status === 'completed') {
      const previousLast = lastVisitByClient.get(visit.clientId)
      if (!previousLast || previousLast < visit.slot.start) {
        lastVisitByClient.set(visit.clientId, visit.slot.start)
      }
      const previousFirst = firstVisitByClient.get(visit.clientId)
      if (!previousFirst || previousFirst > visit.slot.start) {
        firstVisitByClient.set(visit.clientId, visit.slot.start)
      }
    }
  }

  console.log(`  gravando ${appointmentRows.length} visitas …`)
  await insertInChunks(db, appointments, appointmentRows, 150)
  await insertInChunks(db, appointmentItems, itemRows, 200)
  await insertInChunks(db, appointmentStatusEvents, statusEventRows, 500)
  console.log(`  gravando ${staffBlockRows.length} bloqueios de agenda …`)
  await insertInChunks(db, appointmentStaffBlocks, staffBlockRows, 500)
  await insertInChunks(db, appointmentResourceBlocks, resourceBlockRows, 500)

  for (const [clientId, lastVisit] of lastVisitByClient) {
    // ISO string, não Date: em SQL cru o driver não recebe o tipo da coluna
    // do Drizzle e não sabe serializar um Date sozinho
    const first = (firstVisitByClient.get(clientId) ?? lastVisit).toISOString()
    await db.execute(sql`
      update client_profiles
         set last_visit_at = ${lastVisit.toISOString()},
             first_visit_at = ${first}
       where id = ${clientId}
    `)
  }

  const reserved = planned.filter((v) => v.reservesTime).length
  console.log(`  agendamentos: ${planned.length} (${reserved} ocupando horário)`)
  console.log('✓ seed concluído')
}

/**
 * Insere em lotes. O Postgres aceita no máximo 65535 parâmetros por comando —
 * o lote precisa caber nisso considerando o número de colunas da tabela.
 */
async function insertInChunks<T extends Parameters<ReturnType<typeof getDb>['insert']>[0]>(
  db: ReturnType<typeof getDb>,
  table: T,
  rows: readonly Record<string, unknown>[],
  size: number,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    /* O `any` é o preço de a função servir qualquer tabela: `values()` quer o
       tipo de inserção daquela tabela em concreto, e aqui só se sabe que é
       *alguma*. Quem chama passa as linhas já com a forma certa e é aí que o
       compilador as confere — este ponto é só a passagem. */
    await db.insert(table).values(rows.slice(i, i + size) as never[])
  }
}

function hasCheckedIn(status: string): boolean {
  return ['checked_in', 'in_progress', 'completed'].includes(status)
}

function hasStarted(status: string): boolean {
  return ['in_progress', 'completed'].includes(status)
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * Limpa tudo. Descobre as tabelas em vez de listá-las: lista escrita à mão
 * envelhece e o seed passa a deixar lixo de tabela nova para trás.
 *
 * `deployment_env` fica de fora de propósito. Ela é a marca que faz o próximo
 * seed se recusar a rodar — apagá-la aqui desarmaria o freio justamente no
 * banco onde ele mais importa.
 */
async function wipe(db: ReturnType<typeof getDb>): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(sql`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'deployment_env'
  `)
  const names = [...rows].map((r) => `"${r.tablename}"`)
  if (names.length === 0) {
    throw new Error('nenhuma tabela encontrada — rode `npm run db:migrate` antes do seed')
  }
  await db.execute(sql.raw(`truncate table ${names.join(', ')} restart identity cascade`))
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    console.error('✗ seed falhou:', error)
    await closeDb()
    process.exit(1)
  })
