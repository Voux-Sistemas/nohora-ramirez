/**
 * Radiografia do banco.
 *
 *     npm run db:inspect
 *
 * Serve para dois momentos: conferir que o seed produziu um estúdio plausível,
 * e mostrar num ecrã só o que o sistema está a guardar.
 *
 * As horas saem no fuso da unidade, lido da própria linha — estavam fixadas em
 * `America/Sao_Paulo`, do tempo em que o estúdio fictício era a única coisa que
 * havia. Contra a rede portuguesa isso mostrava cada atendimento quatro horas
 * antes de ele ter acontecido, e nada na tabela dizia porquê.
 */
import './env'
import postgres from 'postgres'

async function main(): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1 })

  try {
    console.log('\n── Agenda por unidade e situação ───────────────────────────')
    console.table(
      await sql`
        select u.name as unidade, a.status as situacao, count(*)::int as visitas
          from appointments a join units u on u.id = a.unit_id
         group by 1, 2 order by 1, 2`,
    )

    console.log('\n── Gap booking: itens que liberam o profissional no meio ───')
    console.table(
      await sql`
        select s.name as servico, count(*)::int as ocorrencias
          from (select appointment_item_id
                  from appointment_staff_blocks
                 group by 1 having count(*) = 2) t
          join appointment_items i on i.id = t.appointment_item_id
          join services s on s.id = i.service_id
         group by 1 order by 2 desc`,
    )

    console.log('\n── Exemplo de um atendimento com pausa ─────────────────────')
    console.table(
      await sql`
        select s.name as servico, st.display_name as profissional,
               to_char(lower(b.block) at time zone un.timezone, 'DD/MM HH24:MI') as inicio,
               to_char(upper(b.block) at time zone un.timezone, 'HH24:MI') as fim
          from appointment_staff_blocks b
          join appointment_items i on i.id = b.appointment_item_id
          join appointments a on a.id = i.appointment_id
          join units un on un.id = a.unit_id
          join services s on s.id = i.service_id
          join staff_profiles st on st.id = b.staff_id
         where b.appointment_item_id = (
           select appointment_item_id from appointment_staff_blocks
            group by 1 having count(*) = 2 limit 1)
         order by b.block`,
    )

    console.log('\n── Horas ocupadas por profissional ─────────────────────────')
    console.table(
      await sql`
        select st.display_name as profissional,
               round(sum(extract(epoch from (upper(b.block) - lower(b.block)))) / 3600)::int as horas
          from appointment_staff_blocks b
          join staff_profiles st on st.id = b.staff_id
         group by 1 order by 2 desc`,
    )

    console.log('\n── Faturamento das visitas concluídas ──────────────────────')
    console.table(
      await sql`
        select u.name as unidade,
               count(*)::int as visitas,
               to_char(sum(a.total_price) / 100.0, 'FM999G999D00') as total,
               to_char(avg(a.total_price) / 100.0, 'FM999G999D00') as ticket_medio
          from appointments a join units u on u.id = a.unit_id
         where a.status = 'completed'
         group by 1 order by 2 desc`,
    )
  } finally {
    await sql.end()
  }
}

void main()
