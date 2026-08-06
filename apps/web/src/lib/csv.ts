/**
 * A leitura de CSV mora em `@studio/core` porque é função pura e o que ela
 * precisa provar — separador do Excel pt-BR, BOM, aspas, linha vazia no fim —
 * se prova com teste, não abrindo tela.
 *
 * Este arquivo continua existindo só para o caminho `@/lib/csv` seguir válido.
 */
export { detectSeparator, parseCsv, type CsvSeparator } from '@studio/core'
