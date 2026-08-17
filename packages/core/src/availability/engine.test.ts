import { describe, expect, it } from 'vitest'
import type { TimeRange } from '../time/range.js'
import { cartDurationMin, findAvailableSlots, planVisitAt } from './engine.js'
import type {
  AvailabilityQuery,
  ResourceAvailability,
  ServiceSpec,
  StaffAvailability,
} from './types.js'

// ─── helpers ────────────────────────────────────────────────────────────────
// Tudo em UTC para o teste não depender do fuso da máquina.

const DAY = '2026-08-10'
const NEXT_DAY = '2026-08-11'

const at = (time: string, day = DAY): Date => new Date(`${day}T${time}:00.000Z`)
const range = (a: string, b: string, day = DAY): TimeRange => ({
  start: at(a, day),
  end: at(b, day),
})
const hhmm = (date: Date): string => date.toISOString().slice(11, 16)
const startsOf = (slots: { start: Date }[]): string[] => slots.map((s) => hhmm(s.start))

function svc(
  serviceId: string,
  opts: {
    setup: number
    processing?: number
    finish?: number
    before?: number
    after?: number
    resources?: string[]
  },
): ServiceSpec {
  return {
    serviceId,
    duration: {
      setupMin: opts.setup,
      processingMin: opts.processing ?? 0,
      finishMin: opts.finish ?? 0,
      bufferBeforeMin: opts.before ?? 0,
      bufferAfterMin: opts.after ?? 0,
    },
    requiredResourceTypeIds: opts.resources ?? [],
  }
}

function staff(
  staffId: string,
  opts: {
    skills: string[]
    working?: TimeRange[]
    busy?: TimeRange[]
    online?: boolean
  },
): StaffAvailability {
  return {
    staffId,
    skillServiceIds: opts.skills,
    workingRanges: opts.working ?? [range('09:00', '18:00')],
    busyRanges: opts.busy ?? [],
    acceptsOnlineBooking: opts.online,
  }
}

function resource(
  resourceId: string,
  resourceTypeId: string,
  busy: TimeRange[] = [],
): ResourceAvailability {
  return { resourceId, resourceTypeId, busyRanges: busy }
}

const CORTE = svc('corte', { setup: 30 })
const ESCOVA = svc('escova', { setup: 45 })
const COLORACAO = svc('coloracao', { setup: 30, processing: 40, finish: 30 })

function query(overrides: Partial<AvailabilityQuery>): AvailabilityQuery {
  return {
    unitOpenRanges: [range('09:00', '18:00')],
    cart: [{ serviceId: 'corte' }],
    services: { corte: CORTE, escova: ESCOVA, coloracao: COLORACAO },
    staff: [staff('ana', { skills: ['corte', 'escova', 'coloracao'] })],
    resources: [],
    granularityMin: 15,
    now: at('08:00'),
    staffPickStrategy: 'first-available',
    ...overrides,
  }
}

// ─── grade básica ───────────────────────────────────────────────────────────

describe('grade de horários', () => {
  it('oferece um slot por passo da grade até caber o serviço inteiro', () => {
    const slots = findAvailableSlots(query({}))
    // corte de 30min numa janela de 9h: 09:00 … 17:30, de 15 em 15
    expect(slots).toHaveLength(35)
    expect(hhmm(slots[0]!.start)).toBe('09:00')
    expect(hhmm(slots.at(-1)!.start)).toBe('17:30')
  })

  it('respeita a granularidade configurada', () => {
    const slots = findAvailableSlots(query({ granularityMin: 30 }))
    expect(startsOf(slots.slice(0, 4))).toEqual(['09:00', '09:30', '10:00', '10:30'])
  })

  it('não oferece horário que ultrapasse o fechamento da unidade', () => {
    const slots = findAvailableSlots(
      query({ unitOpenRanges: [range('09:00', '10:00')], cart: [{ serviceId: 'escova' }] }),
    )
    // escova de 45min: 09:00 e 09:15 cabem; 09:30 já passaria das 10:00
    expect(startsOf(slots)).toEqual(['09:00', '09:15'])
  })

  it('não deixa a visita atravessar o intervalo de almoço da unidade', () => {
    const slots = findAvailableSlots(
      query({
        unitOpenRanges: [range('09:00', '12:00'), range('13:00', '18:00')],
        cart: [{ serviceId: 'coloracao' }], // 100 min
        granularityMin: 60,
      }),
    )
    expect(startsOf(slots)).toContain('10:00') // 10:00–11:40, cabe antes do almoço
    expect(startsOf(slots)).not.toContain('11:00') // passaria das 12:00
    expect(startsOf(slots)).toContain('13:00')
  })
})

// ─── gap booking: o diferencial ─────────────────────────────────────────────

describe('tempo de processamento (gap booking)', () => {
  it('libera o profissional durante o processamento e ocupa só aplicação e finalização', () => {
    const slot = planVisitAt(query({ cart: [{ serviceId: 'coloracao' }] }), at('09:00'))!
    const item = slot.items[0]!

    expect(hhmm(item.start)).toBe('09:00')
    expect(hhmm(item.end)).toBe('10:40')
    expect(item.staffBusy.map((r) => `${hhmm(r.start)}-${hhmm(r.end)}`)).toEqual([
      '09:00-09:30', // aplicação
      '10:10-10:40', // finalização
    ])
    // o recurso, esse fica preso o tempo todo
    expect(hhmm(item.resourceBusy.start)).toBe('09:00')
    expect(hhmm(item.resourceBusy.end)).toBe('10:40')
  })

  it('encaixa outro cliente dentro do intervalo de processamento', () => {
    const ana = staff('ana', {
      skills: ['corte', 'coloracao'],
      working: [range('09:00', '12:00')],
      // ocupações de uma coloração já marcada às 09:00
      busy: [range('09:00', '09:30'), range('10:10', '10:40')],
    })

    const slots = findAvailableSlots(
      query({
        unitOpenRanges: [range('09:00', '12:00')],
        cart: [{ serviceId: 'corte' }],
        staff: [ana],
      }),
    )

    // 09:30 é o encaixe dentro da pausa química — é isso que enche a cadeira
    expect(startsOf(slots)).toEqual(['09:30', '10:45', '11:00', '11:15', '11:30'])
  })

  it('trata como bloco único quando não há processamento', () => {
    const slot = planVisitAt(query({}), at('09:00'))!
    expect(slot.items[0]!.staffBusy).toHaveLength(1)
  })
})

// ─── recursos físicos ───────────────────────────────────────────────────────

describe('recursos (cabine, lavatório, equipamento)', () => {
  const COLORACAO_LAV = svc('coloracao', {
    setup: 30,
    processing: 40,
    finish: 30,
    resources: ['lavatorio'],
  })

  it('bloqueia o horário quando o único recurso está ocupado', () => {
    const slots = findAvailableSlots(
      query({
        unitOpenRanges: [range('09:00', '13:00')],
        cart: [{ serviceId: 'coloracao' }],
        services: { corte: CORTE, escova: ESCOVA, coloracao: COLORACAO_LAV },
        resources: [resource('lav-1', 'lavatorio', [range('09:00', '10:00')])],
        granularityMin: 30,
      }),
    )
    // o lavatório só vaga às 10:00
    expect(startsOf(slots)).toEqual(['10:00', '10:30', '11:00'])
  })

  it('usa o segundo recurso do mesmo tipo quando o primeiro está ocupado', () => {
    const doisLavatorios = query({
      unitOpenRanges: [range('09:00', '13:00')],
      cart: [{ serviceId: 'coloracao' }],
      services: { corte: CORTE, escova: ESCOVA, coloracao: COLORACAO_LAV },
      resources: [
        resource('lav-1', 'lavatorio', [range('09:00', '12:00')]),
        resource('lav-2', 'lavatorio'),
      ],
      granularityMin: 30,
    })

    expect(startsOf(findAvailableSlots(doisLavatorios))).toContain('09:00')
    expect(planVisitAt(doisLavatorios, at('09:00'))!.items[0]!.resourceIds).toEqual(['lav-2'])
  })

  it('não oferece horário quando o tipo de recurso exigido não existe na unidade', () => {
    const slots = findAvailableSlots(
      query({
        cart: [{ serviceId: 'coloracao' }],
        services: { corte: CORTE, escova: ESCOVA, coloracao: COLORACAO_LAV },
        resources: [resource('cab-1', 'cabine')],
      }),
    )
    expect(slots).toEqual([])
  })
})

// ─── buffers ────────────────────────────────────────────────────────────────

describe('buffer de limpeza', () => {
  it('impede encostar no próximo atendimento', () => {
    const comBuffer = svc('corte', { setup: 30, after: 15 })
    const ana = staff('ana', {
      skills: ['corte'],
      working: [range('09:00', '12:00')],
      busy: [range('10:00', '11:00')],
    })

    const slots = findAvailableSlots(
      query({
        unitOpenRanges: [range('09:00', '12:00')],
        services: { corte: comBuffer, escova: ESCOVA, coloracao: COLORACAO },
        staff: [ana],
      }),
    )
    // 09:30 daria 09:30–10:00 + 15min de buffer = invade as 10:00
    expect(startsOf(slots)).toEqual(['09:00', '09:15', '11:00', '11:15', '11:30'])
  })

  it('sem buffer, dois atendimentos podem se encostar', () => {
    const ana = staff('ana', {
      skills: ['corte'],
      working: [range('09:00', '12:00')],
      busy: [range('10:00', '11:00')],
    })
    const slots = findAvailableSlots(
      query({ unitOpenRanges: [range('09:00', '12:00')], staff: [ana] }),
    )
    expect(startsOf(slots)).toContain('09:30') // 09:30–10:00 encosta e é válido
  })

  it('não aplica buffer entre serviços da mesma visita', () => {
    const corte = svc('corte', { setup: 30, before: 15, after: 15 })
    const escova = svc('escova', { setup: 45, before: 15, after: 15 })

    const slot = planVisitAt(
      query({
        cart: [{ serviceId: 'corte' }, { serviceId: 'escova' }],
        services: { corte, escova, coloracao: COLORACAO },
      }),
      at('09:00'),
    )!

    // o cliente é o mesmo: escova começa no minuto em que o corte termina
    expect(hhmm(slot.items[0]!.end)).toBe('09:30')
    expect(hhmm(slot.items[1]!.start)).toBe('09:30')
    // o buffer aparece só nas bordas da visita
    expect(hhmm(slot.items[0]!.resourceBusy.start)).toBe('08:45')
    expect(hhmm(slot.items[1]!.resourceBusy.end)).toBe('10:30')
  })
})

// ─── carrinho com vários serviços ───────────────────────────────────────────

describe('visita com mais de um serviço', () => {
  it('encadeia os serviços em sequência', () => {
    const slot = planVisitAt(
      query({ cart: [{ serviceId: 'corte' }, { serviceId: 'escova' }] }),
      at('09:00'),
    )!

    expect(slot.totalDurationMin).toBe(75)
    expect(slot.items.map((i) => [i.serviceId, hhmm(i.start), hhmm(i.end)])).toEqual([
      ['corte', '09:00', '09:30'],
      ['escova', '09:30', '10:15'],
    ])
  })

  it('aplica o intervalo configurado entre serviços da mesma visita', () => {
    const slot = planVisitAt(
      query({
        cart: [{ serviceId: 'corte' }, { serviceId: 'escova' }],
        interServiceGapMin: 10,
      }),
      at('09:00'),
    )!
    expect(hhmm(slot.items[1]!.start)).toBe('09:40')
    expect(cartDurationMin(
      [{ serviceId: 'corte' }, { serviceId: 'escova' }],
      { corte: CORTE, escova: ESCOVA },
      10,
    )).toBe(85)
  })

  it('não deixa o mesmo profissional ser reservado duas vezes no mesmo horário', () => {
    // serviço com processamento: o segundo serviço da visita cairia dentro do gap
    const slot = planVisitAt(
      query({ cart: [{ serviceId: 'coloracao' }, { serviceId: 'corte' }] }),
      at('09:00'),
    )!
    // sequencial: o corte só começa depois da coloração terminar
    expect(hhmm(slot.items[1]!.start)).toBe('10:40')
  })
})

// ─── escolha de profissional ────────────────────────────────────────────────

describe('escolha de profissional', () => {
  it('respeita a matriz de habilidades', () => {
    const slots = findAvailableSlots(
      query({
        cart: [{ serviceId: 'coloracao' }],
        staff: [staff('bia', { skills: ['corte'] })],
      }),
    )
    expect(slots).toEqual([])
  })

  it('honra o profissional escolhido pelo cliente', () => {
    const slot = planVisitAt(
      query({
        cart: [{ serviceId: 'corte', staffId: 'bia' }],
        staff: [
          staff('ana', { skills: ['corte'] }),
          staff('bia', { skills: ['corte'] }),
        ],
      }),
      at('09:00'),
    )!
    expect(slot.items[0]!.staffId).toBe('bia')
  })

  it('não oferece horário se o profissional escolhido estiver ocupado, mesmo com outro livre', () => {
    const slot = planVisitAt(
      query({
        cart: [{ serviceId: 'corte', staffId: 'ana' }],
        staff: [
          staff('ana', { skills: ['corte'], busy: [range('09:00', '10:00')] }),
          staff('bia', { skills: ['corte'] }),
        ],
      }),
      at('09:00'),
    )
    expect(slot).toBeNull()
  })

  it('em "sem preferência" com estratégia balanceada, escolhe quem está menos ocupado', () => {
    const slot = planVisitAt(
      query({
        staffPickStrategy: 'balanced',
        staff: [
          staff('ana', { skills: ['corte'], busy: [range('13:00', '17:00')] }),
          staff('bia', { skills: ['corte'], busy: [range('13:00', '14:00')] }),
        ],
      }),
      at('09:00'),
    )!
    expect(slot.items[0]!.staffId).toBe('bia')
  })

  it('em "sem preferência" com estratégia least-gap, encosta no atendimento existente', () => {
    const slot = planVisitAt(
      query({
        staffPickStrategy: 'least-gap',
        staff: [
          staff('ana', { skills: ['corte'], busy: [range('15:00', '16:00')] }),
          staff('bia', { skills: ['corte'], busy: [range('09:30', '10:00')] }),
        ],
      }),
      at('10:00'),
    )!
    // bia acabou de vagar às 10:00 → aproveitar antes de abrir buraco na agenda da ana
    expect(slot.items[0]!.staffId).toBe('bia')
  })

  it('filtra quem não aceita agendamento online quando a consulta é do cliente', () => {
    const slots = findAvailableSlots(
      query({
        onlineOnly: true,
        staff: [staff('ana', { skills: ['corte'], online: false })],
      }),
    )
    expect(slots).toEqual([])
  })
})

// ─── escala e bloqueios ─────────────────────────────────────────────────────

describe('escala do profissional', () => {
  it('não oferece horário fora do turno, mesmo com a unidade aberta', () => {
    const slots = findAvailableSlots(
      query({
        unitOpenRanges: [range('09:00', '18:00')],
        staff: [staff('ana', { skills: ['corte'], working: [range('09:00', '12:00')] })],
        granularityMin: 60,
      }),
    )
    expect(startsOf(slots)).toEqual(['09:00', '10:00', '11:00'])
  })

  it('não deixa o serviço extrapolar o fim do turno', () => {
    const slots = findAvailableSlots(
      query({
        cart: [{ serviceId: 'escova' }], // 45 min
        unitOpenRanges: [range('09:00', '18:00')],
        staff: [staff('ana', { skills: ['escova'], working: [range('09:00', '10:00')] })],
      }),
    )
    expect(startsOf(slots)).toEqual(['09:00', '09:15'])
  })

  it('respeita bloqueio de almoço já removido da escala', () => {
    const slots = findAvailableSlots(
      query({
        unitOpenRanges: [range('09:00', '18:00')],
        staff: [
          staff('ana', {
            skills: ['corte'],
            working: [range('09:00', '12:00'), range('13:00', '15:00')],
          }),
        ],
        granularityMin: 60,
      }),
    )
    expect(startsOf(slots)).toEqual(['09:00', '10:00', '11:00', '13:00', '14:00'])
  })
})

// ─── regras de antecedência ─────────────────────────────────────────────────

describe('regras de antecedência', () => {
  it('respeita a antecedência mínima', () => {
    const slots = findAvailableSlots(
      query({ now: at('09:00'), minLeadMin: 120, granularityMin: 60 }),
    )
    expect(hhmm(slots[0]!.start)).toBe('11:00')
  })

  it('corta os horários além da antecedência máxima', () => {
    const doisDias = {
      unitOpenRanges: [range('09:00', '18:00'), range('09:00', '18:00', NEXT_DAY)],
      staff: [
        staff('ana', {
          skills: ['corte'],
          working: [range('09:00', '18:00'), range('09:00', '18:00', NEXT_DAY)],
        }),
      ],
      now: at('08:00'),
      granularityMin: 60,
    }

    // teto de 1 dia: o dia seguinte só abre às 09:00, depois do limite das 08:00
    const curto = findAvailableSlots(query({ ...doisDias, maxLeadDays: 1 }))
    expect(new Set(curto.map((s) => s.start.toISOString().slice(0, 10)))).toEqual(new Set([DAY]))

    // teto de 2 dias: o dia seguinte entra
    const longo = findAvailableSlots(query({ ...doisDias, maxLeadDays: 2 }))
    expect(new Set(longo.map((s) => s.start.toISOString().slice(0, 10)))).toEqual(
      new Set([DAY, NEXT_DAY]),
    )
  })

  it('não oferece horário no passado', () => {
    const slots = findAvailableSlots(query({ now: at('14:07'), granularityMin: 60 }))
    expect(hhmm(slots[0]!.start)).toBe('15:00')
  })
})

// ─── validação na confirmação ───────────────────────────────────────────────

describe('planVisitAt — revalidação no momento de confirmar', () => {
  it('recusa horário que acabou de ser preenchido', () => {
    const ocupada = staff('ana', { skills: ['corte'], busy: [range('09:00', '10:00')] })
    expect(planVisitAt(query({ staff: [ocupada] }), at('09:30'))).toBeNull()
  })

  it('recusa horário com a unidade fechada', () => {
    expect(planVisitAt(query({}), at('19:00'))).toBeNull()
  })

  it('aceita o horário válido e devolve o plano completo para gravação', () => {
    const slot = planVisitAt(query({}), at('09:00'))!
    expect(slot.items[0]).toMatchObject({ serviceId: 'corte', staffId: 'ana' })
    expect(slot.totalDurationMin).toBe(30)
  })

  // o separador aberto de manhã que só confirma à tarde
  it('recusa horário que já passou, mesmo com a loja aberta e a profissional livre', () => {
    expect(planVisitAt(query({ now: at('14:10') }), at('12:00'))).toBeNull()
  })

  it('recusa horário dentro da antecedência mínima da loja', () => {
    expect(planVisitAt(query({ now: at('09:00'), minLeadMin: 120 }), at('10:00'))).toBeNull()
    expect(planVisitAt(query({ now: at('09:00'), minLeadMin: 120 }), at('11:00'))).not.toBeNull()
  })

  it('recusa horário além da janela que a loja abriu', () => {
    const amanha = {
      now: at('09:00'),
      unitOpenRanges: [range('09:00', '18:00', NEXT_DAY)],
      staff: [staff('ana', { skills: ['corte'], working: [range('09:00', '18:00', NEXT_DAY)] })],
    }
    expect(planVisitAt(query({ ...amanha, maxLeadDays: 0 }), at('10:00', NEXT_DAY))).toBeNull()
    expect(planVisitAt(query({ ...amanha, maxLeadDays: 2 }), at('10:00', NEXT_DAY))).not.toBeNull()
  })
})

// ─── limites e erros ────────────────────────────────────────────────────────

describe('limites', () => {
  it('respeita o teto de slots retornados', () => {
    expect(findAvailableSlots(query({ limit: 5 }))).toHaveLength(5)
  })

  it('reclama de carrinho vazio', () => {
    expect(() => findAvailableSlots(query({ cart: [] }))).toThrow(/vazio/i)
  })

  it('reclama de serviço desconhecido', () => {
    expect(() => findAvailableSlots(query({ cart: [{ serviceId: 'inexistente' }] }))).toThrow(
      /desconhecido/i,
    )
  })

  it('reclama de granularidade inválida', () => {
    expect(() => findAvailableSlots(query({ granularityMin: 0 }))).toThrow(/granularidade/i)
  })
})
