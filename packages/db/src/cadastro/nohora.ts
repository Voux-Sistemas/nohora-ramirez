/**
 * A carga inicial da rede NOHORA RAMIREZ — Beauty Studio.
 *
 *     npm run cadastro --workspace=@studio/db
 *
 * É o único script do pacote feito para correr CONTRA PRODUÇÃO, e por isso não
 * chama `assertNotProduction`: apontá-lo ao banco do salão é o objetivo, não o
 * acidente. A trava é outra, e está em todas as funções abaixo — **só
 * acrescenta**. Cada linha é procurada pela chave natural (o slug da unidade, o
 * nome da categoria, o nome do serviço dentro da categoria) e criada só se
 * faltar; campo que já tem valor nunca é reescrito. Correr duas vezes não
 * duplica nada, e correr depois de a dona ter corrigido um preço pelo painel não
 * desfaz a correção dela.
 *
 * Isso também o torna útil como remendo: se faltarem três serviços porque o
 * preçário mudou, acrescenta-se ao `precario.ts` e corre-se outra vez.
 *
 * ONDE CORRER. O Postgres de produção não é alcançável de fora da rede da
 * Railway — não há proxy TCP nem URL pública. Então:
 *
 *     railway ssh --service web
 *     npm run cadastro --workspace=@studio/db
 *
 * O container já tem `DATABASE_URL` e as credenciais do bucket como variáveis de
 * referência, que é a razão de o upload das fotografias acontecer aqui dentro:
 * assim a chave secreta do bucket nunca sai da Railway.
 */

import '../env'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { and, eq, sql } from 'drizzle-orm'
import { closeDb, getDb, type Database } from '../index'
import { organizations, serviceCategories, services, unitPhotos, units } from '../schema/index'
import { PRECARIO } from './precario'

/** A raiz do repositório, a partir de `packages/db/src/cadastro/`. */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

interface FotoDaLoja {
  /** Nome do ficheiro em `material/fotos/<pasta>/`. */
  ficheiro: string
  /** O que está na imagem, para quem não a vê. */
  alt: string
}

interface Loja {
  nome: string
  slug: string
  /** Pasta em `material/fotos/`. */
  pasta: string
  addressLine: string
  city: string
  /** Distrito, em Portugal. */
  state: string
  /**
   * A primeira fotografia da pasta é a capa (`units.image_url`), o resto é a
   * galeria (`unit_photos`), nesta ordem. A capa tem de ser deitada: a página da
   * loja abre-a numa banda larga, e um retrato ali fica cortado no meio.
   */
  fotos: readonly FotoDaLoja[]
}

/*
  As duas moradas saem do rodapé do preçário. O telemóvel é o mesmo nas duas
  folhas — é o número da rede, não o da loja —, e fica em E.164 porque é o
  formato que o `formatPhone` e o link de WhatsApp esperam. Código postal e
  freguesia ficam de fora: o papel não os traz, e inventar morada é a única
  mentira que o sistema não consegue desfazer sozinho.
*/
const LOJAS: readonly Loja[] = [
  {
    nome: 'Valongo',
    slug: 'valongo',
    pasta: 'valongo',
    addressLine: 'Centro Comercial Continente Valongo, Loja 07',
    city: 'Valongo',
    state: 'Porto',
    fotos: [
      {
        ficheiro: '01-montra.jpg',
        alt:
          'A montra da loja no centro comercial, à noite, com o letreiro NOHORA ' +
          'RAMIREZ BEAUTY STUDIO em fundo preto e a sala iluminada por trás do vidro.',
      },
      {
        ficheiro: '02-colorbar.jpg',
        alt:
          'A parede do ColorBar: a carta de cores inteira acesa sobre prateleiras ' +
          'escuras de produto, e à frente os lavatórios brancos com cadeiras pretas.',
      },
      {
        ficheiro: '03-lavagem.jpg',
        alt:
          'Duas cadeiras de lavagem em pele preta com apoio de braço cromado, ' +
          'lavatórios brancos e uma parede verde ao lado.',
      },
      {
        ficheiro: '04-sala.jpg',
        alt:
          'A sala vista de ponta a ponta: painel alto de carvalho com banco ' +
          'corrido, tapete claro, os postos de corte ao fundo e a parede verde ' +
          'junto aos lavatórios.',
      },
      {
        ficheiro: '05-maquilhagem.jpg',
        alt:
          'O posto de maquilhagem: espelho redondo contornado de lâmpadas sobre ' +
          'uma bancada de carvalho, com os produtos alinhados.',
      },
      {
        ficheiro: '06-colorbar-lavagem.jpg',
        alt:
          'O ColorBar visto de longe, com a zona de lavagem à frente e a parede ' +
          'verde do lado esquerdo.',
      },
    ],
  },
  {
    nome: 'Maia',
    slug: 'maia',
    pasta: 'maia',
    addressLine: 'Praceta Zona Comercial Chantre, Loja 19',
    city: 'Maia',
    state: 'Porto',
    fotos: [
      {
        ficheiro: '01-lavagem.jpg',
        alt:
          'Os lavatórios pretos sobre bancada branca, com as prateleiras de ' +
          'produto ao fundo.',
      },
      {
        ficheiro: '02-espelhos.jpg',
        alt:
          'Dois espelhos retroiluminados suspensos do teto, bancadas brancas e ' +
          'cadeiras pretas acolchoadas contra o cortinado que cobre a parede toda.',
      },
      {
        ficheiro: '03-cadeiras.jpg',
        alt:
          'As cadeiras de lavagem em pele preta, com o secador de campânula e o ' +
          'espelho que reflete a sala.',
      },
    ],
  },
]

const REDE = {
  nome: 'NOHORA RAMIREZ — Beauty Studio',
  slug: 'nohora-ramirez',
  instagram: 'NOHORA16',
  telefone: '+351934730344',
  fuso: 'Europe/Lisbon',
}

/*
  As regras de marcação com que as duas lojas nascem. São o padrão do formulário
  de unidade — ficam aqui para a loja criada por este script não nascer com
  `settings` vazio, que a agenda leria como "zero minutos de antecedência".
*/
const REGRAS = {
  minLeadMin: 120,
  maxLeadDays: 60,
  granularityMin: 15,
  cancellationWindowHours: 24,
  interServiceGapMin: 0,
}

async function main(): Promise<void> {
  const db = getDb({ max: 1 })
  try {
    const orgId = await garantirRede(db)
    for (const loja of LOJAS) await garantirLoja(db, orgId, loja)
    await garantirPrecario(db, orgId)
    console.log('\nCadastro concluído.')
  } finally {
    await closeDb()
  }
}

/**
 * A rede.
 *
 * Procura a PRIMEIRA linha de `organizations` em vez de procurar pelo slug: um
 * deploy serve uma rede, e se já existe uma linha ela é esta — criar uma segunda
 * ao lado deixaria o painel a mostrar metade do salão sem ninguém perceber
 * porquê. Só o Instagram é preenchido em cima do que existe, e só se estiver
 * vazio: o resto é do dono do painel.
 */
async function garantirRede(db: Database): Promise<string> {
  const [existente] = await db
    .select({ id: organizations.id, name: organizations.name, settings: organizations.settings })
    .from(organizations)
    .limit(1)

  if (existente) {
    if (!existente.settings.instagram) {
      /* Mescla, não substitui: `settings` guarda mais do que o Instagram, e
         reescrever o objeto inteiro apagaria em silêncio o que lá estiver. */
      await db
        .update(organizations)
        .set({
          settings: sql`${organizations.settings} || ${JSON.stringify({
            instagram: REDE.instagram,
          })}::jsonb`,
        })
        .where(eq(organizations.id, existente.id))
      console.log(`→ rede "${existente.name}": Instagram @${REDE.instagram} gravado`)
    } else {
      console.log(`→ rede "${existente.name}": já cadastrada`)
    }
    return existente.id
  }

  const [criada] = await db
    .insert(organizations)
    .values({
      name: REDE.nome,
      slug: REDE.slug,
      timezone: REDE.fuso,
      settings: { instagram: REDE.instagram },
    })
    .returning({ id: organizations.id })
  console.log(`→ rede "${REDE.nome}": criada`)
  return criada!.id
}

async function garantirLoja(db: Database, orgId: string, loja: Loja): Promise<void> {
  const [existente] = await db
    .select({
      id: units.id,
      phone: units.phone,
      addressLine: units.addressLine,
      city: units.city,
      state: units.state,
      imageUrl: units.imageUrl,
    })
    .from(units)
    .where(and(eq(units.organizationId, orgId), eq(units.slug, loja.slug)))
    .limit(1)

  let unitId: string
  if (existente) {
    /* Preenche buraco, não corrige: se a morada já lá está, quem a escreveu
       viu-a com mais atenção do que um script consegue. */
    const faltando = {
      ...(existente.phone ? {} : { phone: REDE.telefone }),
      ...(existente.addressLine ? {} : { addressLine: loja.addressLine }),
      ...(existente.city ? {} : { city: loja.city }),
      ...(existente.state ? {} : { state: loja.state }),
    }
    if (Object.keys(faltando).length > 0) {
      await db.update(units).set(faltando).where(eq(units.id, existente.id))
    }
    unitId = existente.id
    console.log(`\n→ loja "${loja.nome}": já existe${Object.keys(faltando).length ? ' (campos vazios preenchidos)' : ''}`)
  } else {
    const [criada] = await db
      .insert(units)
      .values({
        organizationId: orgId,
        name: loja.nome,
        slug: loja.slug,
        phone: REDE.telefone,
        addressLine: loja.addressLine,
        city: loja.city,
        state: loja.state,
        timezone: REDE.fuso,
        settings: REGRAS,
      })
      .returning({ id: units.id })
    unitId = criada!.id
    console.log(`\n→ loja "${loja.nome}": criada`)
  }

  await garantirFotos(db, unitId, loja, existente?.imageUrl ?? null)
}

/**
 * O ensaio da loja.
 *
 * A chave do ficheiro no bucket é derivada do nome que está em `material/`, e
 * não sorteada como no upload pelo painel: correr o script outra vez tem de
 * sobrescrever o mesmo objeto, e não deixar nove órfãos por trás em cada
 * tentativa. É também o que permite reconhecer, pela URL, a fotografia que já
 * está cadastrada.
 */
async function garantirFotos(
  db: Database,
  unitId: string,
  loja: Loja,
  capaAtual: string | null,
): Promise<void> {
  const jaTem = new Set(
    (await db.select({ url: unitPhotos.url }).from(unitPhotos).where(eq(unitPhotos.unitId, unitId)))
      .map((linha) => linha.url),
  )

  for (const [i, foto] of loja.fotos.entries()) {
    const key = `unidades/${unitId}/${foto.ficheiro}`
    const url = `/api/imagens/${key}`
    const capa = i === 0

    /* A capa não entra na galeria: a página da loja já a mostra em cima, e
       repeti-la logo a seguir é a única forma de um ensaio de seis fotografias
       parecer preguiçoso. */
    if (!capa && jaTem.has(url)) {
      console.log(`   ${foto.ficheiro} — já estava`)
      continue
    }
    if (capa && capaAtual) {
      console.log(`   ${foto.ficheiro} — capa já definida, não mexo`)
      continue
    }

    await guardar(key, join(RAIZ, 'material', 'fotos', loja.pasta, foto.ficheiro))
    if (capa) {
      await db.update(units).set({ imageUrl: url }).where(eq(units.id, unitId))
      console.log(`   ${foto.ficheiro} — capa`)
      continue
    }
    await db.insert(unitPhotos).values({ unitId, url, alt: foto.alt, sortOrder: i })
    console.log(`   ${foto.ficheiro} — galeria, posição ${i}`)
  }
}

async function garantirPrecario(db: Database, orgId: string): Promise<void> {
  console.log('\n→ preçário')
  let novas = 0
  let novos = 0

  for (const [ordemCat, categoria] of PRECARIO.entries()) {
    const [existente] = await db
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(
        and(eq(serviceCategories.organizationId, orgId), eq(serviceCategories.name, categoria.nome)),
      )
      .limit(1)

    let categoryId: string
    if (existente) {
      categoryId = existente.id
    } else {
      const [criada] = await db
        .insert(serviceCategories)
        .values({
          organizationId: orgId,
          name: categoria.nome,
          note: categoria.nota ?? null,
          sortOrder: ordemCat,
        })
        .returning({ id: serviceCategories.id })
      categoryId = criada!.id
      novas++
    }

    let acrescentados = 0
    for (const [ordem, servico] of categoria.servicos.entries()) {
      const [jaExiste] = await db
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            eq(services.organizationId, orgId),
            eq(services.categoryId, categoryId),
            eq(services.name, servico.nome),
          ),
        )
        .limit(1)
      if (jaExiste) continue

      /*
        Duração inteira em `setupMin`. O esquema sabe partir o tempo em aplicação
        / pausa / finalização — uma coloração deixa a cabeleireira livre meia
        hora enquanto a tinta atua —, mas a dona pediu para não usar isso: são
        três números por serviço para responder em vez de um, e sessenta e sete
        serviços vezes três é uma reunião que não acaba. Fica um só, e a agenda
        trata a duração como bloco contínuo.
      */
      await db.insert(services).values({
        organizationId: orgId,
        categoryId,
        name: servico.nome,
        basePrice: servico.preco,
        setupMin: servico.min,
        sortOrder: ordem,
      })
      acrescentados++
      novos++
    }
    console.log(
      `   ${categoria.nome}: ${acrescentados} de ${categoria.servicos.length} serviços acrescentados`,
    )
  }
  console.log(`   ${novas} categorias e ${novos} serviços novos`)
}

/*
  Guardar um ficheiro onde o `IMAGE_STORE` mandar.

  Não importa `apps/web/src/server/storage`: aquele módulo é `server-only` e a
  aplicação não é dependência deste pacote. São dez linhas repetidas, e a
  duplicação é contida de propósito — o que tem de coincidir com o driver da
  aplicação é só o formato da URL (`/api/imagens/<chave>`), porque é o que fica
  gravado na coluna. O resto é abrir um ficheiro e mandá-lo para o mesmo sítio.
*/
async function guardar(key: string, ficheiro: string): Promise<void> {
  const body = await readFile(ficheiro)

  if ((process.env.IMAGE_STORE ?? 'local') !== 's3') {
    /*
      Raiz fixa em `apps/web/.uploads`, e não `process.cwd()/.uploads` como no
      driver da aplicação. É o mesmo sítio: a aplicação corre a partir de
      `apps/web` e este script a partir de `packages/db`, então usar o diretório
      de trabalho aqui gravaria nove ficheiros que o servidor de desenvolvimento
      nunca acharia — e a página abriria com nove quadrados vazios.
    */
    const { mkdir, writeFile } = await import('node:fs/promises')
    const raiz = process.env.UPLOAD_DIR ?? join(RAIZ, 'apps', 'web', '.uploads')
    const destino = join(raiz, key)
    await mkdir(dirname(destino), { recursive: true })
    await writeFile(destino, body)
    return
  }

  const { sha256Hex, signRequest } = await import('@studio/core/s3')
  const base = new URL(exigir('S3_ENDPOINT'))
  // estilo de subdomínio: o bucket vira host, que é o que a Railway espera
  base.host = `${exigir('S3_BUCKET')}.${base.host}`
  const hash = sha256Hex(body)

  const assinada = signRequest({
    method: 'PUT',
    url: `${base.origin}/${key.split('/').map(encodeURIComponent).join('/')}`,
    payloadHash: hash,
    headers: { 'content-type': 'image/jpeg', 'x-amz-content-sha256': hash },
    credentials: {
      accessKeyId: exigir('S3_ACCESS_KEY_ID'),
      secretAccessKey: exigir('S3_SECRET_ACCESS_KEY'),
      region: process.env.S3_REGION || 'auto',
    },
  })

  const resposta = await fetch(assinada.url, {
    method: 'PUT',
    headers: assinada.headers,
    body: new Uint8Array(body),
  })
  if (!resposta.ok) {
    throw new Error(`bucket recusou ${key}: ${resposta.status} ${resposta.statusText}`)
  }
}

function exigir(nome: string): string {
  const valor = process.env[nome]
  if (!valor) throw new Error(`IMAGE_STORE=s3 exige ${nome} — ver ops/README.md.`)
  return valor
}

void main().catch((erro) => {
  console.error('\nFalhou:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
})
