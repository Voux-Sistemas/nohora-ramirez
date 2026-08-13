/**
 * O preçário, transcrito.
 *
 * Fonte: `material/precario.pdf` — os dois talões que a dona imprime e põe ao
 * balcão. O conteúdo é igual nas duas lojas e só a morada muda, e é por isso que
 * o catálogo é da rede: duplicar sessenta e sete serviços por unidade seria
 * duplicar sessenta e sete oportunidades de os dois papéis discordarem.
 *
 * Preço em CÊNTIMOS, como toda coluna de dinheiro do esquema.
 *
 * A DURAÇÃO NÃO VEM DO PAPEL. O talão não imprime tempo nenhum, e a página
 * pública também não o mostra — cada `min` aqui é estimativa nossa, posta para a
 * agenda ter com que trabalhar no primeiro dia. Está na lista de conferência da
 * dona, que é quem vai corrigir olhando a própria marcação. Onde houve dúvida
 * arredondámos para cima: errar para mais deixa a cabeleireira à espera, errar
 * para menos põe duas clientes na mesma cadeira.
 */

export interface ServicoDoPrecario {
  nome: string
  /** Em cêntimos. */
  preco: number
  /** Estimativa provisória, em minutos. Ver o bloco acima. */
  min: number
}

export interface CategoriaDoPrecario {
  nome: string
  /** O asterisco impresso ao pé do bloco, palavra por palavra. */
  nota?: string
  servicos: readonly ServicoDoPrecario[]
}

/*
  Os dois primeiros blocos do talão repetem a mesma lista de nove serviços com
  duas colunas de preço — cabelo curto e cabelo comprido. Ficam como duas
  categorias, e não como um serviço com duas variantes, porque é assim que a
  cliente lê a folha e é assim que a recepção cobra: ela olha o cabelo, escolhe
  a coluna e diz o preço.
*/
const COMPRIMENTO_NOTA = 'Cabelos longos e volumosos sob avaliação.'

export const PRECARIO: readonly CategoriaDoPrecario[] = [
  {
    nome: 'Cabelo curto',
    nota: COMPRIMENTO_NOTA,
    servicos: [
      { nome: 'Brushing', preco: 1500, min: 30 },
      { nome: 'Penteados', preco: 3500, min: 45 },
      { nome: 'Madeixas + brushing', preco: 8000, min: 120 },
      { nome: 'Botox capilar', preco: 8000, min: 90 },
      { nome: 'Alisamento', preco: 10000, min: 120 },
      { nome: 'Permanente', preco: 6000, min: 120 },
      { nome: 'Tratamento Truss', preco: 4000, min: 45 },
      { nome: 'Tratamento Brae', preco: 4000, min: 45 },
      { nome: 'Balayage, babylights, ombré ou morena iluminada', preco: 12000, min: 150 },
    ],
  },
  {
    nome: 'Cabelo comprido',
    nota: COMPRIMENTO_NOTA,
    servicos: [
      { nome: 'Brushing', preco: 2000, min: 45 },
      { nome: 'Penteados', preco: 4500, min: 60 },
      { nome: 'Madeixas + brushing', preco: 10000, min: 150 },
      { nome: 'Botox capilar', preco: 12000, min: 120 },
      { nome: 'Alisamento', preco: 18000, min: 180 },
      { nome: 'Permanente', preco: 10000, min: 150 },
      { nome: 'Tratamento Truss', preco: 6000, min: 60 },
      { nome: 'Tratamento Brae', preco: 6000, min: 60 },
      { nome: 'Balayage, babylights, ombré ou morena iluminada', preco: 15000, min: 180 },
    ],
  },
  {
    nome: 'Outros serviços',
    nota:
      'Cabelos com extensões sob avaliação. Em todos os serviços de coloração ' +
      'está incluído shampoo e hidratação L’Oréal Professionnel.',
    servicos: [
      { nome: 'Brushing com ondas babyliss', preco: 2500, min: 45 },
      { nome: 'Corte senhora (sem brushing)', preco: 1500, min: 30 },
      { nome: 'Corte criança (até 8 anos)', preco: 1000, min: 20 },
      { nome: 'Franja', preco: 1000, min: 15 },
      { nome: 'Lavar sem secar', preco: 1000, min: 15 },
      { nome: 'Ampola', preco: 1500, min: 20 },
      { nome: 'Máscara básica', preco: 500, min: 15 },
      { nome: 'Coloração raiz', preco: 5000, min: 60 },
      { nome: 'Coloração raiz sem amoníaco', preco: 5000, min: 60 },
      { nome: 'Coloração INOA', preco: 5000, min: 60 },
      { nome: 'Descoloração raiz', preco: 6000, min: 90 },
      { nome: 'Descoloração total', preco: 9000, min: 120 },
      { nome: 'Tratamento plex', preco: 3000, min: 30 },
      { nome: 'Matização', preco: 3000, min: 30 },
      { nome: 'Corte masculino', preco: 1500, min: 30 },
      { nome: 'Barba à navalha', preco: 1500, min: 30 },
      { nome: 'Barba à tesoura ou máquina', preco: 1000, min: 20 },
      { nome: 'Aparar bigode', preco: 600, min: 10 },
    ],
  },
  {
    nome: 'Mãos e pés',
    nota: 'Manicure francesa ou nail art (+2 unhas) acresce 5 € ao valor total.',
    servicos: [
      { nome: 'Manicure normal', preco: 1500, min: 45 },
      { nome: 'Verniz gel extra-forte', preco: 2000, min: 60 },
      { nome: 'Manutenção de gel', preco: 2500, min: 60 },
      { nome: 'Manutenção de acrílico', preco: 3000, min: 75 },
      { nome: 'Nail art elaborada (+2 unhas)', preco: 3000, min: 30 },
      { nome: 'Aplicação de gel', preco: 3000, min: 90 },
      { nome: 'Remoção de gel', preco: 1500, min: 30 },
      { nome: 'Aplicação de acrílico', preco: 3000, min: 90 },
      { nome: 'Manutenção cliente nova', preco: 3000, min: 75 },
      { nome: 'Pedicure completa', preco: 2500, min: 45 },
      { nome: 'Pedicure completa + verniz normal', preco: 3000, min: 60 },
      { nome: 'Pedicure completa + verniz gel', preco: 3500, min: 75 },
      { nome: 'Pintura e cutículas', preco: 2000, min: 30 },
      { nome: 'Verniz normal (mãos)', preco: 1000, min: 20 },
      { nome: 'Verniz normal (pés)', preco: 2000, min: 20 },
    ],
  },
  {
    nome: 'Tratamentos de rosto',
    servicos: [
      { nome: 'Sobrancelha', preco: 1000, min: 15 },
      { nome: 'Sobrancelha a linha', preco: 1500, min: 20 },
      { nome: 'Buço', preco: 600, min: 10 },
      { nome: 'Queixo', preco: 600, min: 10 },
      { nome: 'Aplicação de henna', preco: 1800, min: 30 },
      { nome: 'Limpeza facial com peeling', preco: 5000, min: 75 },
      { nome: 'Limpeza facial simples', preco: 3200, min: 60 },
      { nome: 'Maquilhagem simples', preco: 3500, min: 45 },
      { nome: 'Maquilhagem elaborada', preco: 5000, min: 60 },
    ],
  },
  {
    nome: 'Corpo',
    nota: 'Depilação a cera.',
    servicos: [
      { nome: 'Peito e abdómen', preco: 2000, min: 30 },
      { nome: 'Axilas', preco: 800, min: 15 },
      { nome: 'Meia perna', preco: 1200, min: 20 },
      { nome: 'Perna completa', preco: 2000, min: 30 },
      { nome: 'Virilha completa', preco: 2000, min: 30 },
      { nome: 'Braços', preco: 1500, min: 20 },
      { nome: 'Costas', preco: 1500, min: 25 },
    ],
  },
]
