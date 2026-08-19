import { ratearDesconto } from '@studio/core'

/**
 * Quem produziu o quê, no mês — a soma, sem o banco.
 *
 * O painel sabia somar a rede e sabia somar cada loja; entre as duas coisas
 * faltava a pessoa. A dona pergunta "quanto é que a Bia fez este mês" a um ecrã
 * que responde "as duas lojas fizeram 8 400 €", e a conta que ela faz a seguir
 * é de cabeça, ao fim do mês — que é exactamente quando o número interessa e
 * quando já não há forma de o reconstruir.
 *
 * Está aqui, e não junto da consulta que a alimenta, pela mesma razão que o
 * preçário: é aritmética, e aritmética que não fecha ao cêntimo custa caro num
 * ecrã sobre dinheiro. Aqui prova-se sem levantar um Postgres.
 *
 * O rateio do desconto é o nó. A comanda leva desconto uma vez, sobre a visita
 * inteira, e a produção é por item — cada linha tem a sua profissional. Fazer
 * essa proporção em SQL era pedir arredondamento ao Postgres numa expressão
 * onde ele não sabe que os cêntimos têm de fechar; `ratearDesconto` sabe, e é a
 * mesma função com que o fecho da comanda lança a comissão. Mesma conta, mesmo
 * cêntimo, e os dois ecrãs a bater um com o outro.
 */

/** Um item de uma visita concluída, com o desconto da comanda a que pertence. */
export interface LinhaDeProducao {
  appointmentId: string
  unitId: string
  staffId: string
  staffName: string
  staffColor: string
  serviceId: string
  serviceName: string
  price: number
  /**
   * O desconto da comanda INTEIRA, repetido em cada item dela — é o mesmo
   * `left join` do painel, e uma comanda só tem uma linha de desconto. Lê-se
   * uma vez por visita; somá-lo por item multiplicava-o.
   */
  discount: number
}

export interface ProducaoDeStaff {
  staffId: string
  nome: string
  cor: string
  /**
   * Visitas distintas, não itens: quem fez escova e coloração à mesma cliente
   * atendeu uma pessoa, não duas.
   */
  atendimentos: number
  liquido: number
  /** O mesmo líquido partido por loja, para quem atende em mais do que uma. */
  porUnidade: { unitId: string; liquido: number }[]
}

export interface ProducaoDeServico {
  serviceId: string
  nome: string
  vezes: number
  liquido: number
}

export interface Producao {
  /** Por líquido, do maior para o menor — a ordem É o ranking. */
  porStaff: ProducaoDeStaff[]
  porServico: ProducaoDeServico[]
}

export function agruparProducao(linhas: readonly LinhaDeProducao[]): Producao {
  /* Primeiro por visita, porque o desconto é da visita: só depois de saber
     quanto cada item passou a valer é que se pode dizer de quem é o dinheiro. */
  const porVisita = new Map<string, LinhaDeProducao[]>()
  for (const linha of linhas) {
    const atual = porVisita.get(linha.appointmentId)
    if (atual) atual.push(linha)
    else porVisita.set(linha.appointmentId, [linha])
  }

  const staff = new Map<string, ProducaoDeStaff>()
  const servicos = new Map<string, ProducaoDeServico>()
  /* Uma visita conta uma vez por profissional, e não uma vez por item dela. */
  const visitasContadas = new Set<string>()

  for (const [appointmentId, itens] of porVisita) {
    const partes = ratearDesconto(
      itens.map((item) => item.price),
      itens[0]?.discount ?? 0,
    )

    itens.forEach((item, i) => {
      /* O chão em zero é para a comanda oferecida por inteiro: o desconto pode
         igualar o preço, e nunca o ultrapassa — mas produção negativa era um
         número que a lista não sabe desenhar. */
      const liquido = Math.max(0, item.price - (partes[i] ?? 0))

      const pessoa = staff.get(item.staffId) ?? {
        staffId: item.staffId,
        nome: item.staffName,
        cor: item.staffColor,
        atendimentos: 0,
        liquido: 0,
        porUnidade: [],
      }
      pessoa.liquido += liquido
      const chaveVisita = `${item.staffId}:${appointmentId}`
      if (!visitasContadas.has(chaveVisita)) {
        visitasContadas.add(chaveVisita)
        pessoa.atendimentos += 1
      }
      const loja = pessoa.porUnidade.find((linha) => linha.unitId === item.unitId)
      if (loja) loja.liquido += liquido
      else pessoa.porUnidade.push({ unitId: item.unitId, liquido })
      staff.set(item.staffId, pessoa)

      const servico = servicos.get(item.serviceId) ?? {
        serviceId: item.serviceId,
        nome: item.serviceName,
        vezes: 0,
        liquido: 0,
      }
      servico.vezes += 1
      servico.liquido += liquido
      servicos.set(item.serviceId, servico)
    })
  }

  /* Empate desfeito pelo nome e não pela ordem de chegada: duas profissionais
     a zero no início do mês trocavam de lugar a cada refrescar da página. */
  const porLiquido = <T extends { liquido: number; nome: string }>(a: T, b: T) =>
    b.liquido - a.liquido || a.nome.localeCompare(b.nome)

  for (const pessoa of staff.values()) {
    pessoa.porUnidade.sort((a, b) => b.liquido - a.liquido)
  }

  return {
    porStaff: [...staff.values()].sort(porLiquido),
    porServico: [...servicos.values()].sort(porLiquido),
  }
}
