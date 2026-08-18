/**
 * As clientes da demonstração.
 *
 * Nomes inventados, do Grande Porto, e nenhum deles corresponde a pessoa real —
 * este ficheiro é lido por um script que escreve na base de produção do salão, e
 * uma cliente de mentira com nome e telefone de alguém de verdade seria um
 * registo falso no cadastro de um negócio a sério.
 *
 * O telefone e o e-mail não são só improváveis, são impossíveis por construção:
 *
 *   · `+351 909…` — em Portugal o telemóvel começa em 91, 92, 93 ou 96. O 90 não
 *     está atribuído a ninguém e não pode vir a colidir com uma cliente real,
 *     que é o que aconteceria se se escolhesse um 91 «que ninguém usa».
 *
 *     O `909` e não o `900` porque o cadastro do salão chegou primeiro à mesma
 *     ideia: as contas provisórias da equipa vivem em `+351 900000001` a `003`.
 *     A primeira versão disto começava exactamente aí e a base recusou-a — o que
 *     é o comportamento certo, mas dois blocos de mentira não podem partilhar o
 *     mesmo início.
 *   · `.invalid` — TLD reservado pela RFC 2606 justamente para isto. Nunca
 *     resolve, portanto nenhum e-mail do sistema pode sair para lá por engano.
 *
 * As duas coisas juntas são também o que torna a limpeza segura de conferir: se
 * ficar para trás alguma cliente de demonstração, ela dá-se a ver ao olho.
 */

export interface DemoClient {
  nome: string
  aniversario: string
  /**
   * Loja habitual. Sem ela, a cliente é de passagem — vai a uma e a outra, e
   * aparece muito menos vezes na agenda gerada. É esse contraste que dá à
   * carteira a forma que uma carteira tem: um núcleo de habituais e uma cauda
   * comprida de quem foi lá uma vez.
   */
  loja?: 'valongo' | 'maia'
  etiquetas?: readonly string[]
  comoConheceu?: string
  /** Observação interna, do género que a recepção escreve de facto. */
  nota?: string
}

/**
 * As fichas escritas à mão: alergia, casamento, a filha que vem junto. São as
 * que se abrem numa demonstração, e nenhum gerador as escreveria.
 */
const DESTAQUES: readonly DemoClient[] = [
  {
    nome: 'Sofia Marques',
    aniversario: '1991-03-14',
    loja: 'valongo',
    etiquetas: ['fiel'],
    comoConheceu: 'Indicação de amiga',
    nota: 'Couro cabeludo sensível — evitar água muito quente.',
  },
  { nome: 'Beatriz Antunes', aniversario: '1996-11-02', loja: 'valongo', comoConheceu: 'Instagram' },
  {
    nome: 'Carolina Pinto',
    aniversario: '1988-06-27',
    loja: 'maia',
    etiquetas: ['fiel'],
    comoConheceu: 'Passou à porta',
  },
  { nome: 'Mariana Sousa', aniversario: '1999-01-19', loja: 'valongo', comoConheceu: 'Google' },
  {
    nome: 'Inês Ferreira',
    aniversario: '1985-09-08',
    loja: 'maia',
    etiquetas: ['noiva'],
    nota: 'Casamento a 12 de setembro. Prova de penteado marcada à parte.',
  },
  { nome: 'Rita Cardoso', aniversario: '1993-04-30', loja: 'valongo', comoConheceu: 'Instagram' },
  {
    nome: 'Catarina Lopes',
    aniversario: '1990-12-11',
    loja: 'maia',
    etiquetas: ['fiel'],
    comoConheceu: 'Indicação de amiga',
  },
  { nome: 'Joana Teixeira', aniversario: '1997-07-23', loja: 'valongo' },
  { nome: 'Ana Rita Moreira', aniversario: '1982-02-05', loja: 'maia', comoConheceu: 'Facebook' },
  {
    nome: 'Helena Barbosa',
    aniversario: '1975-10-17',
    loja: 'valongo',
    etiquetas: ['fiel'],
    nota: 'Vem sempre com a filha. Marcar as duas seguidas.',
  },
  { nome: 'Patrícia Gomes', aniversario: '1994-05-29', loja: 'maia', comoConheceu: 'Instagram' },
  { nome: 'Daniela Ribeiro', aniversario: '2000-08-03', loja: 'valongo', comoConheceu: 'TikTok' },
  {
    nome: 'Sara Magalhães',
    aniversario: '1987-01-26',
    loja: 'maia',
    etiquetas: ['fiel'],
    comoConheceu: 'Indicação de amiga',
  },
  { nome: 'Filipa Nogueira', aniversario: '1992-09-14', loja: 'valongo' },
  { nome: 'Margarida Coelho', aniversario: '1998-03-07', loja: 'maia', comoConheceu: 'Google' },
  {
    nome: 'Cláudia Fonseca',
    aniversario: '1979-11-21',
    loja: 'valongo',
    nota: 'Alergia a amoníaco — coloração só sem amoníaco.',
  },
  { nome: 'Vera Pacheco', aniversario: '1995-06-12', loja: 'maia', comoConheceu: 'Passou à porta' },
  { nome: 'Liliana Rocha', aniversario: '1989-02-18', loja: 'valongo', etiquetas: ['fiel'] },
  { nome: 'Cristina Amaral', aniversario: '1972-07-04', loja: 'maia', comoConheceu: 'Facebook' },
  { nome: 'Andreia Sampaio', aniversario: '2001-10-09', loja: 'valongo', comoConheceu: 'Instagram' },
  { nome: 'Tânia Guimarães', aniversario: '1986-12-31', loja: 'maia' },
  {
    nome: 'Raquel Fernandes',
    aniversario: '1993-08-16',
    loja: 'valongo',
    comoConheceu: 'Indicação de amiga',
  },
  { nome: 'Susana Leite', aniversario: '1981-04-22', loja: 'maia', etiquetas: ['fiel'] },
  {
    nome: 'Marta Vasconcelos',
    aniversario: '1996-01-08',
    loja: 'valongo',
    nota: 'Prefere marcações ao fim do dia — sai do trabalho às 18h.',
  },
  { nome: 'Diana Correia', aniversario: '1999-05-25', loja: 'maia', comoConheceu: 'TikTok' },
  { nome: 'Bruna Salgado', aniversario: '2002-09-30', loja: 'valongo', comoConheceu: 'Instagram' },
  { nome: 'Isabel Menezes', aniversario: '1968-03-02', loja: 'maia', etiquetas: ['fiel'] },
  { nome: 'Núria Castro', aniversario: '1990-10-13', loja: 'valongo', comoConheceu: 'Google' },
  { nome: 'Alexandra Pires', aniversario: '1984-06-06', loja: 'maia' },
  {
    nome: 'Elisabete Braga',
    aniversario: '1977-08-28',
    loja: 'valongo',
    comoConheceu: 'Passou à porta',
  },
  { nome: 'Luísa Cunha', aniversario: '1994-11-15', loja: 'maia', etiquetas: ['fiel'] },
  { nome: 'Célia Matos', aniversario: '1983-02-24', loja: 'valongo', comoConheceu: 'Facebook' },
  { nome: 'Paula Ventura', aniversario: '1991-07-19', loja: 'maia' },
  {
    nome: 'Miguel Andrade',
    aniversario: '1989-09-05',
    loja: 'valongo',
    comoConheceu: 'Indicação de amiga',
  },
  { nome: 'Ricardo Seabra', aniversario: '1995-12-08', loja: 'maia', comoConheceu: 'Google' },
  { nome: 'Nuno Bettencourt', aniversario: '1980-05-11', loja: 'valongo' },
]

// ─── a cauda ────────────────────────────────────────────────────────────────

/**
 * O resto da carteira, montado por combinação.
 *
 * Trinta e seis fichas escritas à mão davam uma agenda em que cada pessoa ia ao
 * salão vinte e cinco vezes em sete semanas — quatro vezes por semana, o que não
 * é uma cliente, é uma funcionária. O número de visitas está certo para duas
 * cadeiras; o que faltava era gente para as encher.
 *
 * Duzentas e vinte pessoas põem a média em menos de quatro visitas cada, e com o
 * peso da loja habitual isso reparte-se como se reparte de verdade: as habituais
 * de mês a mês, as de passagem uma vez e mais nada.
 */
const NOMES: readonly string[] = [
  'Ana', 'Maria', 'Rita', 'Sofia', 'Inês', 'Joana', 'Carla', 'Sandra',
  'Teresa', 'Mónica', 'Catarina', 'Beatriz', 'Carolina', 'Mariana', 'Leonor',
  'Matilde', 'Constança', 'Bárbara', 'Débora', 'Salomé', 'Adriana', 'Fernanda',
  'Graça', 'Olívia', 'Emília', 'Rosário', 'Berta', 'Alice', 'Irene', 'Lúcia',
  'Anabela', 'Fátima', 'Manuela', 'Conceição', 'Dulce', 'Idalina', 'Zulmira',
  'Benedita', 'Iris', 'Gabriela', 'Eduarda', 'Vânia', 'Sónia', 'Cátia',
  'Micaela', 'Jéssica', 'Telma', 'Silvia', 'Nádia', 'Marlene',
  'João', 'Pedro', 'Tiago', 'André', 'Bruno', 'Hugo', 'Rui', 'Vítor',
  'Duarte', 'Gonçalo',
]

const APELIDOS: readonly string[] = [
  'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues',
  'Martins', 'Jesus', 'Sousa', 'Fernandes', 'Gonçalves', 'Gomes', 'Lopes',
  'Marques', 'Alves', 'Almeida', 'Ribeiro', 'Pinto', 'Carvalho', 'Teixeira',
  'Moreira', 'Correia', 'Mendes', 'Nunes', 'Soares', 'Vieira', 'Monteiro',
  'Cardoso', 'Rocha', 'Neves', 'Coelho', 'Cruz', 'Cunha', 'Pires', 'Ramos',
  'Reis', 'Simões', 'Antunes', 'Matos', 'Barbosa', 'Azevedo', 'Machado',
  'Figueiredo', 'Fonseca', 'Freitas', 'Baptista', 'Miranda', 'Leite', 'Amaral',
]

const CANAIS: readonly string[] = [
  'Indicação de amiga',
  'Instagram',
  'Google',
  'Passou à porta',
  'Facebook',
  'TikTok',
]

/** Quantas pessoas a carteira tem ao todo, destaques incluídos. */
const TAMANHO_DA_CARTEIRA = 220

function gerarCarteira(quantas: number): DemoClient[] {
  const vistos = new Set(DESTAQUES.map((c) => c.nome))
  const geradas: DemoClient[] = []

  /* Passos primos sobre listas de 50/60 fazem os pares andarem os dois ao mesmo
     tempo em vez de repetirem o apelido de sessenta em sessenta nomes. O `Set`
     é que garante que não sai nome repetido — o passo só o torna raro. */
  for (let i = 0; geradas.length < quantas && i < quantas * 8; i++) {
    const proprio = NOMES[i % NOMES.length]!
    const primeiro = APELIDOS[(i * 7) % APELIDOS.length]!
    const segundo = APELIDOS[(i * 11 + 3) % APELIDOS.length]!
    const nome =
      i % 3 === 0 && primeiro !== segundo
        ? `${proprio} ${primeiro} ${segundo}`
        : `${proprio} ${primeiro}`
    if (vistos.has(nome)) continue
    vistos.add(nome)

    // uma em cada três é de passagem: sem loja habitual, poucas visitas
    const dePassagem = i % 3 === 1
    const ano = 1962 + ((i * 17) % 44)
    const mes = 1 + ((i * 5) % 12)
    const dia = 1 + ((i * 13) % 28)

    geradas.push({
      nome,
      aniversario: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      ...(dePassagem ? {} : { loja: i % 2 === 0 ? ('valongo' as const) : ('maia' as const) }),
      // a maioria das fichas reais não diz por onde a pessoa chegou
      ...(i % 4 === 0 ? { comoConheceu: CANAIS[(i * 3) % CANAIS.length]! } : {}),
      ...(i % 9 === 0 ? { etiquetas: ['fiel'] } : {}),
    })
  }

  return geradas
}

export const CLIENTES: readonly DemoClient[] = [
  ...DESTAQUES,
  ...gerarCarteira(TAMANHO_DA_CARTEIRA - DESTAQUES.length),
]

/** Prefixo comum a todos, para os reconhecer numa listagem. */
export const PREFIXO_TELEFONE_DEMO = '+351909'

/**
 * Telefone da demonstração para o índice dado. Ver o cabeçalho: o prefixo 909
 * não é telemóvel português, portanto este número não pode ser de ninguém.
 */
export function telefoneDemo(indice: number): string {
  return `${PREFIXO_TELEFONE_DEMO}${String(indice + 1).padStart(6, '0')}`
}

/**
 * `Sara Magalhães` → `sara.magalhaes@exemplo.invalid`.
 *
 * `NFD` parte a letra acentuada em letra + acento solto, e a primeira limpeza
 * fica só com letras e espaço: os acentos caem sem precisarem de estar listados
 * um a um. Os dois passos são precisos por essa ordem — apagar tudo o que não é
 * letra *incluindo* o espaço daria `saramagalhaes`, e trocar o acento por ponto
 * daria `sara.magalha.es`.
 */
export function emailDemo(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z ]+/g, '')
    .trim()
    .replace(/ +/g, '.')
  return `${limpo}@exemplo.invalid`
}
