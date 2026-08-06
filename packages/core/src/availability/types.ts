import type { TimeRange } from '../time/range.js'

/**
 * Perfil de duração de um serviço.
 *
 * O ponto central do sistema: em serviços químicos o profissional aplica,
 * espera o processamento (livre nesse intervalo) e finaliza. A cadeira/cabine
 * fica ocupada o tempo todo; o profissional, não.
 *
 *   |── setup ──|──── processing ────|── finish ──|
 *   ^^^^^^^^^^^^                      ^^^^^^^^^^^^   profissional OCUPADO
 *                ^^^^^^^^^^^^^^^^^^^^                profissional LIVRE (gap)
 *   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   recurso OCUPADO
 */
export interface ServiceDuration {
  /** Aplicação — profissional ocupado. */
  readonly setupMin: number
  /** Processamento — profissional livre, recurso ocupado. Zero na maioria dos serviços. */
  readonly processingMin: number
  /** Finalização — profissional ocupado. */
  readonly finishMin: number
  /** Folga antes do atendimento (preparo/limpeza). Aplicada só na borda da visita. */
  readonly bufferBeforeMin: number
  /** Folga depois do atendimento. Aplicada só na borda da visita. */
  readonly bufferAfterMin: number
}

export interface ServiceSpec {
  readonly serviceId: string
  readonly duration: ServiceDuration
  /** Tipos de recurso exigidos (cabine, lavatório, equipamento). Vazio = não exige. */
  readonly requiredResourceTypeIds: readonly string[]
}

export interface StaffAvailability {
  readonly staffId: string
  /** Serviços que este profissional sabe/pode executar. */
  readonly skillServiceIds: readonly string[]
  /** Escala já cruzada com o horário da unidade e limpa de folgas/férias. */
  readonly workingRanges: readonly TimeRange[]
  /** Blocos em que já está de fato ocupado (não inclui processamento de outros atendimentos). */
  readonly busyRanges: readonly TimeRange[]
  /** Se aceita ser escolhido em agendamento online. */
  readonly acceptsOnlineBooking?: boolean
}

export interface ResourceAvailability {
  readonly resourceId: string
  readonly resourceTypeId: string
  /** Ocupações do recurso — incluem o período inteiro do serviço, processamento junto. */
  readonly busyRanges: readonly TimeRange[]
}

export interface CartItem {
  readonly serviceId: string
  /** Profissional escolhido pelo cliente. Ausente = "sem preferência". */
  readonly staffId?: string
}

export type StaffPickStrategy =
  /** Primeiro elegível na ordem recebida — determinístico, bom para teste. */
  | 'first-available'
  /** Distribui a carga: prefere quem tem menos minutos ocupados no dia. */
  | 'balanced'
  /** Minimiza buraco na agenda: prefere encostar em um atendimento existente. */
  | 'least-gap'

export interface AvailabilityQuery {
  /** Janelas em que a unidade está aberta no período consultado (feriados já removidos). */
  readonly unitOpenRanges: readonly TimeRange[]
  readonly cart: readonly CartItem[]
  readonly services: Readonly<Record<string, ServiceSpec>>
  readonly staff: readonly StaffAvailability[]
  readonly resources: readonly ResourceAvailability[]
  /** Passo da grade de horários, em minutos. */
  readonly granularityMin: number
  /** Instante de referência para as regras de antecedência. */
  readonly now: Date
  /** Antecedência mínima para agendar. */
  readonly minLeadMin?: number
  /** Antecedência máxima (quantos dias à frente é possível marcar). */
  readonly maxLeadDays?: number
  /** Intervalo entre serviços da mesma visita. Buffers não se aplicam aqui. */
  readonly interServiceGapMin?: number
  readonly staffPickStrategy?: StaffPickStrategy
  /** Só permite escolher profissionais habilitados para agendamento online. */
  readonly onlineOnly?: boolean
  /** Teto de slots retornados. */
  readonly limit?: number
}

export interface PlannedItem {
  readonly serviceId: string
  readonly staffId: string
  readonly resourceIds: readonly string[]
  /** Início visível ao cliente (sem buffer). */
  readonly start: Date
  /** Fim visível ao cliente (sem buffer). */
  readonly end: Date
  /** Blocos em que o profissional fica travado — é isto que vai para a constraint do banco. */
  readonly staffBusy: readonly TimeRange[]
  /** Bloco em que o recurso fica travado, buffers incluídos. */
  readonly resourceBusy: TimeRange
}

export interface Slot {
  /** Início do primeiro serviço, o horário que o cliente vê. */
  readonly start: Date
  /** Fim do último serviço. */
  readonly end: Date
  readonly totalDurationMin: number
  readonly items: readonly PlannedItem[]
}
