/**
 * O vocabulário da marcação, partilhado entre o servidor e a tela.
 *
 * Vive fora de `server/` de propósito: o fluxo de marcação é um componente de
 * cliente e precisa destes tipos: importá-los de um módulo marcado com
 * `server-only` funcionaria (tipo apaga-se na compilação) mas convidaria o
 * primeiro `import` sem `type` a arrastar o banco de dados para o navegador.
 *
 * Nada aqui é a linha do banco. São as formas que a tela precisa e nada mais —
 * o preço já resolvido, o nome já junto, a duração já somada. É o que evita a
 * tela ter de saber o que é `servicePricing`.
 */

export interface CasaEscolhivel {
  slug: string
  nome: string
  distrito: string | null
  morada: string | null
  imagemUrl: string | null
  /** "Aberto até às 19:00". `null` quando a casa não declarou horário. */
  frase: string | null
  aberta: boolean
}

export interface ServicoEscolhivel {
  id: string
  nome: string
  descricao: string | null
  categoria: string
  /**
   * O piso da casa, em cêntimos. A profissional ainda não foi escolhida e é
   * ela quem fecha o preço — daí `precoVaria`, que faz a tela escrever
   * "desde" em vez de prometer um número que muda no passo seguinte.
   */
  preco: number
  precoVaria: boolean
  duracaoMin: number
  imagemUrl: string | null
  /** Texto do sinal a pagar, já formatado. `null` quando não há sinal. */
  sinal: string | null
  /** Ficha de anamnese obrigatória — avisa antes, não na porta. */
  exigeAnamnese: boolean
}

export interface ProfissionalEscolhivel {
  id: string
  nome: string
  cor: string
}

export interface HorarioLivre {
  /** ISO do início. É este valor — e só ele — que volta na confirmação. */
  inicio: string
  /**
   * "14:30" — a hora de parede na casa, já escrita pelo servidor.
   *
   * A tela não recebe o fuso e não o quer: formatar no navegador daria a hora
   * do telemóvel de quem está a marcar, e uma cliente a marcar de férias no
   * Brasil veria a tarde inteira deslocada quatro horas.
   */
  hora: string
  precoTotal: number
  duracaoMin: number
  /**
   * Quem faz o quê neste horário, na ordem do carrinho.
   *
   * `preco` é o valor JÁ RESOLVIDO para a profissional que ficou com a linha —
   * não o piso da casa que a lista de serviços mostra. Sem ele, o extracto da
   * confirmação somava linhas de piso debaixo de um total resolvido, e as
   * contas não fechavam na única tela em que a cliente as confere.
   */
  equipa: {
    servicoId: string
    servicoNome: string
    staffId: string
    nome: string
    preco: number
  }[]
}

export interface DiaLivre {
  /** Data de parede `YYYY-MM-DD` no fuso da casa. */
  data: string
  /** A casa não abre neste dia — diferente de abrir e estar cheia. */
  fechada: boolean
  horarios: HorarioLivre[]
}
