/**
 * O estúdio fictício.
 *
 * Isto não é "dado de exemplo": é o ambiente de demonstração comercial do
 * produto e a base dos testes de integração (ADR-008). Tem que parecer um
 * estúdio de verdade — com profissional que só atende em uma unidade, serviço
 * que exige avaliação, preço que muda por unidade e agenda que não fecha
 * redondinha.
 *
 * Este estúdio fictício é BRASILEIRO: telefones de onze dígitos, CEP, UF, fuso
 * de São Paulo. Rode a demonstração com `PAIS=BR` — sob `PAIS=PT` os telefones
 * aparecem crus (`+5511…`, porque `formatPhone` devolve intacto o que não é
 * nacional) e os preços saem em euro sobre endereços paulistanos. A rede real
 * em produção é portuguesa e não vem daqui: vem do cadastro.
 *
 * Convenções:
 *   - dinheiro em CENTAVOS
 *   - dia da semana: 0 = domingo … 6 = sábado
 *   - horário em 'HH:MM' no fuso da unidade
 */

export const ORGANIZATION = {
  name: 'Nohora Ramirez',
  slug: 'nohora-ramirez',
  document: '12.345.678/0001-90',
  timezone: 'America/Sao_Paulo',
} as const

// ─── unidades ───────────────────────────────────────────────────────────────

export interface UnitSeed {
  slug: string
  name: string
  phone: string
  addressLine: string
  district: string
  city: string
  state: string
  postalCode: string
  /**
   * Foto da loja. Ilustrativa nesta demonstração — precisa ser trocada pela
   * fotografia real do estúdio antes de ir ao ar. Ver a lista de substituição
   * em PRODUCT.md.
   */
  imageUrl: string | null
  /** [weekday, abre, fecha] — dia ausente = fechado */
  hours: readonly (readonly [number, string, string])[]
  settings: Record<string, unknown>
}

const SETTINGS_PADRAO = {
  minLeadMin: 120,
  maxLeadDays: 60,
  granularityMin: 15,
  cancellationWindowHours: 24,
  interServiceGapMin: 0,
}

export const UNITS: readonly UnitSeed[] = [
  {
    slug: 'centro',
    name: 'Nohora Ramirez Centro',
    phone: '+551133330001',
    addressLine: 'Rua Barão de Itapetininga, 255',
    district: 'República',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01042-001',
    imageUrl: 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&w=1600&q=70',
    hours: [
      [1, '09:00', '20:00'],
      [2, '09:00', '20:00'],
      [3, '09:00', '20:00'],
      [4, '09:00', '21:00'],
      [5, '09:00', '21:00'],
      [6, '08:00', '18:00'],
    ],
    settings: SETTINGS_PADRAO,
  },
  {
    slug: 'jardins',
    name: 'Nohora Ramirez Jardins',
    phone: '+551133330002',
    addressLine: 'Rua Oscar Freire, 1120',
    district: 'Jardins',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01426-001',
    imageUrl: 'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=1600&q=70',
    hours: [
      [2, '10:00', '20:00'],
      [3, '10:00', '20:00'],
      [4, '10:00', '21:00'],
      [5, '10:00', '21:00'],
      [6, '09:00', '19:00'],
    ],
    // unidade de bairro nobre: agenda mais longa e cancelamento mais rígido
    settings: { ...SETTINGS_PADRAO, maxLeadDays: 90, cancellationWindowHours: 48 },
  },
  {
    slug: 'moema',
    name: 'Nohora Ramirez Moema',
    phone: '+551133330003',
    addressLine: 'Av. Ibirapuera, 3103 — Loja 218',
    district: 'Moema',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '04029-200',
    imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=70',
    hours: [
      [0, '14:00', '20:00'],
      [1, '10:00', '22:00'],
      [2, '10:00', '22:00'],
      [3, '10:00', '22:00'],
      [4, '10:00', '22:00'],
      [5, '10:00', '22:00'],
      [6, '10:00', '22:00'],
    ],
    // dentro de shopping: cliente decide na hora, antecedência mínima menor
    settings: { ...SETTINGS_PADRAO, minLeadMin: 60 },
  },
]

// ─── recursos ───────────────────────────────────────────────────────────────

/** Tipos são da rede. */
export const RESOURCE_TYPES = ['Cadeira', 'Lavatório', 'Cabine', 'Mesa de manicure'] as const
export type ResourceTypeName = (typeof RESOURCE_TYPES)[number]

/** unidade → tipo → quantas instâncias existem */
export const RESOURCES: Readonly<Record<string, Partial<Record<ResourceTypeName, number>>>> = {
  centro: { Cadeira: 4, 'Lavatório': 2, Cabine: 1, 'Mesa de manicure': 2 },
  jardins: { Cadeira: 3, 'Lavatório': 2, Cabine: 1, 'Mesa de manicure': 2 },
  moema: { Cadeira: 2, 'Lavatório': 1, Cabine: 2, 'Mesa de manicure': 2 },
}

// ─── catálogo ───────────────────────────────────────────────────────────────

export const CATEGORIES = ['Cabelo', 'Química', 'Tratamento', 'Mãos e pés', 'Estética'] as const
export type CategoryName = (typeof CATEGORIES)[number]

export interface ServiceSeed {
  slug: string
  name: string
  category: CategoryName
  description?: string
  /**
   * Foto do serviço. Ilustrativa; entra na lista de substituição. Ausente é
   * estado legítimo e desenhado — o catálogo real do salão vai começar vazio e
   * ir sendo preenchido, então a placa sem foto precisa ser bonita.
   */
  imageUrl?: string
  basePrice: number
  /** Tempo total com a cliente, do começo ao fim. */
  durationMin: number
  bufferAfterMin: number
  resourceTypes: readonly ResourceTypeName[]
  onlineBookable?: boolean
  requiresDeposit?: boolean
  depositType?: 'percent' | 'fixed'
  depositValue?: number
  requiresAssessment?: boolean
  requiresAnamnesis?: boolean
}

export const SERVICES: readonly ServiceSeed[] = [
  {
    slug: 'corte-fem',
    imageUrl: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=70',
    name: 'Corte feminino',
    category: 'Cabelo',
    description: 'Corte com lavagem e finalização.',
    basePrice: 9000,
    durationMin: 60,
    bufferAfterMin: 10,
    resourceTypes: ['Cadeira'],
  },
  {
    slug: 'escova',
    imageUrl: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1200&q=70',
    name: 'Escova',
    category: 'Cabelo',
    basePrice: 6000,
    durationMin: 40,
    bufferAfterMin: 10,
    resourceTypes: ['Cadeira'],
  },
  {
    slug: 'coloracao',
    name: 'Coloração raiz',
    category: 'Química',
    description: 'Retoque de raiz com a cor escolhida na consulta.',
    basePrice: 18000,
    durationMin: 100,
    bufferAfterMin: 15,
    resourceTypes: ['Cadeira'],
  },
  {
    slug: 'mechas',
    imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=70',
    name: 'Mechas / luzes',
    category: 'Química',
    basePrice: 45000,
    durationMin: 195,
    bufferAfterMin: 15,
    resourceTypes: ['Cadeira'],
    requiresDeposit: true,
    depositType: 'percent',
    depositValue: 3000, // 30% em pontos-base
  },
  {
    slug: 'progressiva',
    imageUrl: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=1200&q=70',
    name: 'Progressiva',
    category: 'Química',
    description: 'Só é agendada após avaliação presencial do fio.',
    basePrice: 35000,
    durationMin: 150,
    bufferAfterMin: 15,
    resourceTypes: ['Cadeira'],
    onlineBookable: false,
    requiresAssessment: true,
  },
  {
    slug: 'hidratacao',
    imageUrl: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=1200&q=70',
    name: 'Hidratação',
    category: 'Tratamento',
    basePrice: 12000,
    durationMin: 60,
    bufferAfterMin: 10,
    resourceTypes: ['Lavatório'],
  },
  {
    slug: 'manicure',
    imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=70',
    name: 'Manicure',
    category: 'Mãos e pés',
    basePrice: 4500,
    durationMin: 45,
    bufferAfterMin: 5,
    resourceTypes: ['Mesa de manicure'],
  },
  {
    slug: 'pedicure',
    name: 'Pedicure',
    category: 'Mãos e pés',
    basePrice: 5500,
    durationMin: 50,
    bufferAfterMin: 5,
    resourceTypes: ['Mesa de manicure'],
  },
  {
    slug: 'sobrancelha',
    name: 'Design de sobrancelha',
    category: 'Estética',
    basePrice: 6000,
    durationMin: 30,
    bufferAfterMin: 5,
    resourceTypes: ['Cabine'],
  },
  {
    slug: 'cilios',
    name: 'Extensão de cílios',
    category: 'Estética',
    basePrice: 25000,
    durationMin: 120,
    bufferAfterMin: 10,
    resourceTypes: ['Cabine'],
    requiresDeposit: true,
    depositType: 'fixed',
    depositValue: 5000,
  },
  {
    slug: 'limpeza-pele',
    imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=70',
    name: 'Limpeza de pele',
    category: 'Estética',
    basePrice: 18000,
    durationMin: 70,
    bufferAfterMin: 15,
    resourceTypes: ['Cabine'],
    requiresAnamnesis: true,
  },
]

// ─── equipe ─────────────────────────────────────────────────────────────────

export interface StaffSeed {
  slug: string
  name: string
  phone: string
  email: string
  bio: string
  /**
   * A cor da profissional na agenda e no avatar que a cliente vê.
   *
   * São pigmentos, não cores de biblioteca: tabaco, ardósia, terracota, oliva,
   * ameixa, fumê, ocre e ferrugem, todos em torno de L 0.55 e croma 0.08 em
   * OKLCH. O roxo e o azul-elétrico que estavam aqui antes vinham da paleta
   * padrão do Tailwind e brigavam com o travertino da marca — pareciam etiqueta
   * de software, e apareciam justamente na tela onde a cliente escolhe quem vai
   * atendê-la. A mesma luminosidade em todos mantém a hierarquia da tela
   * intacta: nenhuma profissional salta mais que a outra.
   */
  color: string
  acceptsOnlineBooking?: boolean
  hiredAt: string
  /** primeira unidade da lista é a principal */
  units: readonly string[]
  skills: readonly string[]
  /** unidade → [weekday, entra, sai][] */
  schedule: Readonly<Record<string, readonly (readonly [number, string, string])[]>>
}

export const STAFF: readonly StaffSeed[] = [
  {
    slug: 'ana',
    name: 'Ana Souza',
    phone: '+5511990000001',
    email: 'ana@nohoraramirez.com.br',
    bio: 'Colorista sênior. Especialista em loiros e correção de cor.',
    color: '#95663a',
    hiredAt: '2019-03-11',
    units: ['centro', 'jardins'],
    skills: ['coloracao', 'mechas', 'progressiva', 'hidratacao', 'corte-fem', 'escova'],
    schedule: {
      centro: [
        [2, '09:00', '18:00'],
        [3, '09:00', '18:00'],
        [4, '09:00', '20:00'],
        [5, '09:00', '20:00'],
      ],
      jardins: [[6, '09:00', '17:00']],
    },
  },
  {
    slug: 'bia',
    name: 'Beatriz Lima',
    phone: '+5511990000002',
    email: 'beatriz@nohoraramirez.com.br',
    bio: 'Corte e finalização. Cachos e franjas.',
    color: '#4b769b',
    hiredAt: '2021-07-05',
    units: ['centro'],
    skills: ['corte-fem', 'escova', 'hidratacao'],
    schedule: {
      centro: [
        [1, '09:00', '18:00'],
        [2, '09:00', '18:00'],
        [3, '09:00', '18:00'],
        [4, '09:00', '18:00'],
        [5, '09:00', '18:00'],
        [6, '08:00', '16:00'],
      ],
    },
  },
  {
    slug: 'carla',
    name: 'Carla Dias',
    phone: '+5511990000003',
    email: 'carla@nohoraramirez.com.br',
    bio: 'Manicure e pedicure. Esmaltação em gel.',
    color: '#a35b45',
    hiredAt: '2020-01-20',
    units: ['jardins'],
    skills: ['manicure', 'pedicure'],
    schedule: {
      jardins: [
        [2, '10:00', '19:00'],
        [3, '10:00', '19:00'],
        [4, '10:00', '19:00'],
        [5, '10:00', '19:00'],
        [6, '09:00', '18:00'],
      ],
    },
  },
  {
    slug: 'duda',
    name: 'Eduarda Reis',
    phone: '+5511990000004',
    email: 'eduarda@nohoraramirez.com.br',
    bio: 'Design de sobrancelha e extensão de cílios.',
    color: '#627b48',
    hiredAt: '2022-02-14',
    units: ['moema', 'centro'],
    skills: ['sobrancelha', 'cilios'],
    schedule: {
      moema: [
        [1, '12:00', '21:00'],
        [2, '12:00', '21:00'],
        [3, '12:00', '21:00'],
        [4, '12:00', '21:00'],
      ],
      centro: [[5, '10:00', '18:00']],
    },
  },
  {
    slug: 'elis',
    name: 'Elis Prado',
    phone: '+5511990000005',
    email: 'elis@nohoraramirez.com.br',
    bio: 'Esteticista. Limpeza de pele e protocolos faciais.',
    color: '#935d81',
    // agenda dela é fechada: recepção encaixa depois de conversar
    acceptsOnlineBooking: false,
    hiredAt: '2023-05-02',
    units: ['moema'],
    skills: ['limpeza-pele', 'sobrancelha'],
    schedule: {
      moema: [
        [2, '10:00', '19:00'],
        [3, '10:00', '19:00'],
        [4, '10:00', '19:00'],
        [5, '10:00', '19:00'],
      ],
    },
  },
  {
    slug: 'fabi',
    name: 'Fabiana Rocha',
    phone: '+5511990000006',
    email: 'fabiana@nohoraramirez.com.br',
    bio: 'Cabelo em geral. Escova e tratamento.',
    color: '#3e7d81',
    hiredAt: '2022-09-19',
    units: ['moema'],
    skills: ['corte-fem', 'escova', 'hidratacao', 'coloracao'],
    schedule: {
      moema: [
        [0, '14:00', '20:00'],
        [1, '10:00', '19:00'],
        [3, '10:00', '19:00'],
        [4, '13:00', '22:00'],
        [5, '13:00', '22:00'],
        [6, '10:00', '19:00'],
      ],
    },
  },
  {
    slug: 'gigi',
    name: 'Giovana Mattos',
    phone: '+5511990000007',
    email: 'giovana@nohoraramirez.com.br',
    bio: 'Química e coloração criativa.',
    color: '#997c3c',
    hiredAt: '2021-11-08',
    units: ['jardins'],
    skills: ['coloracao', 'mechas', 'progressiva', 'hidratacao'],
    schedule: {
      jardins: [
        [2, '10:00', '19:00'],
        [3, '10:00', '19:00'],
        [4, '11:00', '20:00'],
        [5, '11:00', '20:00'],
        [6, '09:00', '18:00'],
      ],
    },
  },
  {
    slug: 'helo',
    name: 'Heloísa Nunes',
    phone: '+5511990000008',
    email: 'heloisa@nohoraramirez.com.br',
    bio: 'Manicure e pedicure.',
    color: '#944a4b',
    hiredAt: '2024-03-25',
    units: ['moema', 'centro'],
    skills: ['manicure', 'pedicure'],
    schedule: {
      moema: [
        [1, '10:00', '19:00'],
        [2, '10:00', '19:00'],
        [4, '12:00', '21:00'],
        [5, '12:00', '21:00'],
      ],
      centro: [[6, '08:00', '16:00']],
    },
  },
]

// ─── exceções de preço ──────────────────────────────────────────────────────

export interface PricingSeed {
  service: string
  unit?: string
  staff?: string
  price: number
  durationOverrideMin?: number
  note: string
}

export const PRICING_EXCEPTIONS: readonly PricingSeed[] = [
  {
    service: 'corte-fem',
    unit: 'jardins',
    price: 12000,
    note: 'Jardins cobra mais caro em toda a linha de cabelo',
  },
  { service: 'escova', unit: 'jardins', price: 8000, note: 'idem' },
  {
    service: 'mechas',
    staff: 'ana',
    price: 55000,
    durationOverrideMin: 225,
    note: 'Ana é sênior: cobra mais e leva mais tempo, em qualquer unidade',
  },
  {
    service: 'corte-fem',
    unit: 'centro',
    staff: 'bia',
    price: 8000,
    note: 'exceção mais específica que existe — vence a de unidade',
  },
]

// ─── comissões ──────────────────────────────────────────────────────────────

export interface CommissionSeed {
  staff: string
  /** slug do serviço, nome da categoria, ou nada = regra geral da pessoa */
  service?: string
  category?: CategoryName
  /** pontos-base: 4000 = 40% */
  percentBps?: number
  fixedCents?: number
  deductProductCost?: boolean
  note?: string
}

export const COMMISSIONS: readonly CommissionSeed[] = [
  { staff: 'ana', category: 'Química', percentBps: 4000, deductProductCost: true },
  { staff: 'ana', percentBps: 3500 },
  { staff: 'bia', percentBps: 3000 },
  { staff: 'carla', percentBps: 5000 },
  { staff: 'duda', service: 'cilios', fixedCents: 8000, note: 'fixo por aplicação' },
  { staff: 'duda', percentBps: 4000 },
  { staff: 'elis', percentBps: 4500, deductProductCost: true },
  { staff: 'fabi', percentBps: 3500 },
  { staff: 'gigi', category: 'Química', percentBps: 4000, deductProductCost: true },
  { staff: 'gigi', percentBps: 3000 },
  { staff: 'helo', percentBps: 4500 },
]

// ─── clientes ───────────────────────────────────────────────────────────────

export interface ClientSeed {
  name: string
  phone: string
  email?: string
  birthdate?: string
  preferredUnit?: string
  preferredStaff?: string
  tags?: readonly string[]
  noShowCount?: number
  note?: string
}

export const CLIENTS: readonly ClientSeed[] = [
  { name: 'Camila Ferreira', phone: '+5511970000001', email: 'camila.f@exemplo.com', birthdate: '1991-04-17', preferredUnit: 'centro', preferredStaff: 'ana', tags: ['vip'], note: 'Alérgica a amônia. Sempre confirmar a linha de tinta.' },
  { name: 'Juliana Barbosa', phone: '+5511970000002', birthdate: '1988-09-02', preferredUnit: 'centro', preferredStaff: 'bia' },
  { name: 'Renata Alves', phone: '+5511970000003', email: 'renata@exemplo.com', birthdate: '1995-12-28', preferredUnit: 'jardins', tags: ['vip'] },
  { name: 'Patrícia Gomes', phone: '+5511970000004', birthdate: '1979-06-11', preferredUnit: 'jardins', preferredStaff: 'gigi' },
  { name: 'Larissa Moreira', phone: '+5511970000005', birthdate: '2000-02-05', preferredUnit: 'moema' },
  { name: 'Bianca Teixeira', phone: '+5511970000006', email: 'bianca.t@exemplo.com', preferredUnit: 'moema', preferredStaff: 'duda' },
  { name: 'Fernanda Castro', phone: '+5511970000007', birthdate: '1985-11-19', preferredUnit: 'centro' },
  { name: 'Aline Ribeiro', phone: '+5511970000008', preferredUnit: 'jardins', noShowCount: 2, note: 'Faltou duas vezes sem avisar. Passou a exigir sinal.' },
  { name: 'Priscila Nogueira', phone: '+5511970000009', birthdate: '1993-07-30', preferredUnit: 'centro' },
  { name: 'Tatiane Souza', phone: '+5511970000010', preferredUnit: 'moema' },
  { name: 'Vanessa Lima', phone: '+5511970000011', email: 'vanessa@exemplo.com', birthdate: '1990-01-23', preferredUnit: 'jardins', tags: ['vip'] },
  { name: 'Débora Pinto', phone: '+5511970000012', preferredUnit: 'centro', preferredStaff: 'bia' },
  { name: 'Marcela Antunes', phone: '+5511970000013', birthdate: '1997-08-14', preferredUnit: 'moema', preferredStaff: 'fabi' },
  { name: 'Sabrina Duarte', phone: '+5511970000014', preferredUnit: 'centro' },
  { name: 'Isabela Farias', phone: '+5511970000015', birthdate: '1999-03-09', preferredUnit: 'jardins' },
  { name: 'Natália Campos', phone: '+5511970000016', email: 'natalia@exemplo.com', preferredUnit: 'moema' },
  { name: 'Roberta Vieira', phone: '+5511970000017', birthdate: '1982-05-26', preferredUnit: 'centro', tags: ['vip'] },
  { name: 'Gabriela Martins', phone: '+5511970000018', preferredUnit: 'jardins', preferredStaff: 'carla' },
  { name: 'Amanda Cardoso', phone: '+5511970000019', birthdate: '1994-10-04', preferredUnit: 'moema' },
  { name: 'Letícia Braga', phone: '+5511970000020', preferredUnit: 'centro' },
  { name: 'Carolina Peixoto', phone: '+5511970000021', birthdate: '1987-02-18', preferredUnit: 'jardins' },
  { name: 'Mariana Prado', phone: '+5511970000022', email: 'mariana.p@exemplo.com', preferredUnit: 'moema', preferredStaff: 'elis' },
  { name: 'Simone Rocha', phone: '+5511970000023', birthdate: '1976-12-01', preferredUnit: 'centro' },
  { name: 'Elaine Batista', phone: '+5511970000024', preferredUnit: 'jardins', noShowCount: 1 },
  { name: 'Thaís Monteiro', phone: '+5511970000025', birthdate: '1998-06-22', preferredUnit: 'moema' },
  { name: 'Rafael Mendes', phone: '+5511970000026', email: 'rafael@exemplo.com', preferredUnit: 'centro', note: 'Corte masculino — atende com a Bia.' },
  { name: 'Lucas Andrade', phone: '+5511970000027', preferredUnit: 'moema' },
  { name: 'Bruno Carvalho', phone: '+5511970000028', birthdate: '1992-09-13', preferredUnit: 'jardins' },
]

// ─── equipe administrativa ──────────────────────────────────────────────────

export interface AdminSeed {
  name: string
  phone: string
  email: string
  role: 'owner' | 'receptionist' | 'unit_manager' | 'finance'
  /** nulo = escopo rede */
  unit?: string
}

export const ADMINS: readonly AdminSeed[] = [
  { name: 'Luciana Amaral', phone: '+5511980000001', email: 'luciana@nohoraramirez.com.br', role: 'owner' },
  { name: 'Paula Ventura', phone: '+5511980000002', email: 'paula@nohoraramirez.com.br', role: 'unit_manager', unit: 'centro' },
  { name: 'Cris Balbino', phone: '+5511980000003', email: 'cris@nohoraramirez.com.br', role: 'unit_manager', unit: 'jardins' },
  { name: 'Rita Salgado', phone: '+5511980000004', email: 'rita@nohoraramirez.com.br', role: 'unit_manager', unit: 'moema' },
  { name: 'Jéssica Pontes', phone: '+5511980000005', email: 'jessica@nohoraramirez.com.br', role: 'receptionist', unit: 'centro' },
  { name: 'Vera Lopes', phone: '+5511980000006', email: 'vera@nohoraramirez.com.br', role: 'receptionist', unit: 'jardins' },
  { name: 'Silvia Corrêa', phone: '+5511980000007', email: 'silvia@nohoraramirez.com.br', role: 'receptionist', unit: 'moema' },
]
