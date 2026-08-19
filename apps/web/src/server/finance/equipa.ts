import 'server-only'
import {
  appointmentDiscounts,
  appointmentItems,
  appointments,
  services,
  staffProfiles,
} from '@studio/db'
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import type { LinhaDeProducao } from '@/lib/producao'

/**
 * As linhas que o painel soma por pessoa e por serviço.
 *
 * Traz linhas cruas e não um agregado, por duas razões. A soma verdadeira exige
 * ratear o desconto da comanda pelos itens ao cêntimo, e isso é `ratearDesconto`
 * em JS (`lib/producao.ts`) — a mesma função do fecho da comanda, para os dois
 * ecrãs baterem um com o outro. E a rede pode ter lojas em fusos diferentes: o
 * painel já lê fuso a fuso, e juntar listas de linhas é trivial onde fundir
 * agregados não é.
 *
 * A ordem também não é enfeite. `ratearDesconto` deixa o cêntimo que sobra na
 * última linha da comanda; ordenar pelo `sortOrder` do item faz com que o mesmo
 * mês dê sempre o mesmo número, em vez de o cêntimo mudar de dona conforme a
 * ordem em que o Postgres devolveu as linhas naquele dia.
 */
export async function linhasDeProducao(
  unitIds: readonly string[],
  janela: { inicio: Date; fim: Date },
): Promise<LinhaDeProducao[]> {
  if (unitIds.length === 0) return []

  return db
    .select({
      appointmentId: appointments.id,
      unitId: appointments.unitId,
      staffId: appointmentItems.staffId,
      staffName: staffProfiles.displayName,
      staffColor: staffProfiles.color,
      serviceId: appointmentItems.serviceId,
      serviceName: services.name,
      price: appointmentItems.price,
      discount: sql<number>`coalesce(${appointmentDiscounts.amount}, 0)::int`,
    })
    .from(appointmentItems)
    .innerJoin(appointments, eq(appointments.id, appointmentItems.appointmentId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, appointmentItems.staffId))
    .innerJoin(services, eq(services.id, appointmentItems.serviceId))
    /* Único por `appointment_id`, portanto não multiplica linha nenhuma — é o
       mesmo `left join` de que a faturação do painel depende. */
    .leftJoin(appointmentDiscounts, eq(appointmentDiscounts.appointmentId, appointments.id))
    .where(
      and(
        inArray(appointments.unitId, [...unitIds]),
        // Produção é o que foi feito. Marcado ainda não é dinheiro de ninguém.
        eq(appointments.status, 'completed'),
        gte(appointments.startsAt, janela.inicio),
        lt(appointments.startsAt, janela.fim),
      ),
    )
    .orderBy(asc(appointmentItems.appointmentId), asc(appointmentItems.sortOrder))
}
