import { describe, expect, it } from 'vitest'
import { EMPTY_SHA256, sha256Hex, signRequest } from './sign.js'

/*
  Assinatura é o tipo de código que parece certo e está errado: o servidor
  responde 403 sem dizer qual byte diverge. Por isso o primeiro teste é o vetor
  oficial da AWS (`aws-sig-v4-test-suite`, caso `get-vanilla`) — se ele passa, o
  algoritmo está certo, não só consistente consigo mesmo.
*/
const CREDENCIAL_EXEMPLO = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
}

const MOMENTO = new Date('2015-08-30T12:36:00Z')

function assinaturaDe(cabecalho: string): string {
  return cabecalho.split('Signature=')[1]!
}

describe('signRequest', () => {
  it('bate com o vetor get-vanilla da AWS', () => {
    const { headers } = signRequest({
      method: 'GET',
      url: 'https://example.amazonaws.com/',
      payloadHash: EMPTY_SHA256,
      service: 'service',
      credentials: CREDENCIAL_EXEMPLO,
      now: MOMENTO,
    })

    expect(headers.Authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    )
  })

  it('manda a data no formato que a AWS aceita, sem milissegundo', () => {
    const { headers } = signRequest({
      method: 'GET',
      url: 'https://imagens.exemplo.com/a.jpg',
      payloadHash: EMPTY_SHA256,
      credentials: CREDENCIAL_EXEMPLO,
      now: new Date('2026-08-10T19:41:53.123Z'),
    })

    expect(headers['x-amz-date']).toBe('20260810T194153Z')
  })

  it('assina o host tirado da URL', () => {
    const { headers } = signRequest({
      method: 'GET',
      url: 'https://imagens.bucket.railway.app/unidades/foto.jpg',
      payloadHash: EMPTY_SHA256,
      credentials: CREDENCIAL_EXEMPLO,
      now: MOMENTO,
    })

    expect(headers.host).toBe('imagens.bucket.railway.app')
  })

  /*
    O cabeçalho HTTP não é sensível a caixa mas a assinatura é. Assinar
    `Content-Type` e mandar `content-type` é 403 — então o normalizador precisa
    baixar a caixa antes de assinar.
  */
  it('normaliza o nome do cabecalho para minuscula', () => {
    const comum = {
      method: 'PUT',
      url: 'https://imagens.exemplo.com/a.jpg',
      payloadHash: sha256Hex('conteudo'),
      credentials: CREDENCIAL_EXEMPLO,
      now: MOMENTO,
    }

    const maiuscula = signRequest({ ...comum, headers: { 'Content-Type': 'image/jpeg' } })
    const minuscula = signRequest({ ...comum, headers: { 'content-type': 'image/jpeg' } })

    expect(maiuscula.headers.Authorization).toBe(minuscula.headers.Authorization)
    expect(maiuscula.headers.Authorization).toContain('SignedHeaders=content-type;host;x-amz-date')
  })

  it('muda a assinatura quando o corpo muda', () => {
    const comum = {
      method: 'PUT' as const,
      url: 'https://imagens.exemplo.com/a.jpg',
      credentials: CREDENCIAL_EXEMPLO,
      now: MOMENTO,
    }

    const uma = signRequest({ ...comum, payloadHash: sha256Hex('foto antiga') })
    const outra = signRequest({ ...comum, payloadHash: sha256Hex('foto nova') })

    expect(assinaturaDe(uma.headers.Authorization!)).not.toBe(
      assinaturaDe(outra.headers.Authorization!),
    )
  })

  it('muda a assinatura quando a chave do objeto muda', () => {
    const comum = {
      method: 'GET' as const,
      payloadHash: EMPTY_SHA256,
      credentials: CREDENCIAL_EXEMPLO,
      now: MOMENTO,
    }

    const uma = signRequest({ ...comum, url: 'https://imagens.exemplo.com/a.jpg' })
    const outra = signRequest({ ...comum, url: 'https://imagens.exemplo.com/b.jpg' })

    expect(assinaturaDe(uma.headers.Authorization!)).not.toBe(
      assinaturaDe(outra.headers.Authorization!),
    )
  })

  it('e deterministica: mesma entrada, mesma assinatura', () => {
    const entrada = {
      method: 'DELETE',
      url: 'https://imagens.exemplo.com/unidades/foto.jpg',
      payloadHash: EMPTY_SHA256,
      credentials: CREDENCIAL_EXEMPLO,
      now: MOMENTO,
    }

    expect(signRequest(entrada).headers.Authorization).toBe(
      signRequest(entrada).headers.Authorization,
    )
  })

  it('usa s3 como servico quando ninguem diz o contrario', () => {
    const { headers } = signRequest({
      method: 'GET',
      url: 'https://imagens.exemplo.com/a.jpg',
      payloadHash: EMPTY_SHA256,
      credentials: CREDENCIAL_EXEMPLO,
      now: MOMENTO,
    })

    expect(headers.Authorization).toContain('/us-east-1/s3/aws4_request')
  })
})

describe('sha256Hex', () => {
  it('reconhece o corpo vazio', () => {
    expect(sha256Hex('')).toBe(EMPTY_SHA256)
  })

  it('trata Buffer e string do mesmo jeito', () => {
    expect(sha256Hex(Buffer.from('foto'))).toBe(sha256Hex('foto'))
  })
})
