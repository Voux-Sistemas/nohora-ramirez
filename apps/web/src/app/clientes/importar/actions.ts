'use server'

import { revalidatePath } from 'next/cache'
import { parseCsv } from '@/lib/csv'
import { assertGestao } from '@/server/auth/permissoes'
import { importClients, type ImportResult } from '@/server/people/clients'

export interface ImportState {
  error?: string
  result?: ImportResult
}

const COLUMN_ALIASES: Record<string, 'name' | 'phone' | 'email'> = {
  nome: 'name',
  name: 'name',
  telefone: 'phone',
  phone: 'phone',
  celular: 'phone',
  /* A planilha de um salão português diz "telemóvel" na primeira linha, com e
     sem acento conforme quem digitou. Coluna não reconhecida faz a importação
     inteira parecer vazia, e ninguém desconfia do cabeçalho. */
  telemovel: 'phone',
  telemóvel: 'phone',
  contacto: 'phone',
  email: 'email',
  'e-mail': 'email',
}

export async function importarCsv(_state: ImportState, formData: FormData): Promise<ImportState> {
  /* Importação cria conta de gente: sem porteiro, um arquivo enviado de fora
     encheria a carteira da rede com cadastro que ninguém pediu. */
  await assertGestao()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Selecione um arquivo CSV.' }
  }

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) {
    return { error: 'O arquivo precisa de um cabeçalho e ao menos uma linha de dados.' }
  }

  const header = rows[0]!.map((h) => COLUMN_ALIASES[h.trim().toLowerCase()])
  const nameCol = header.indexOf('name')
  const phoneCol = header.indexOf('phone')
  const emailCol = header.indexOf('email')

  if (nameCol === -1 || phoneCol === -1) {
    return { error: 'O cabeçalho precisa ter as colunas "nome" e "telefone".' }
  }

  const parsed = rows.slice(1).map((cols) => ({
    name: cols[nameCol] ?? '',
    phone: cols[phoneCol] ?? '',
    email: emailCol >= 0 ? cols[emailCol] : undefined,
  }))

  const result = await importClients(parsed)
  revalidatePath('/clientes')
  return { result }
}
