/**
 * A leitura de CSV mora em `@studio/core` porque é função pura, e o que ela
 * precisa de provar — o separador que o Excel em português usa, o BOM, as
 * aspas, a linha vazia no fim — prova-se com teste, não abrindo um ecrã.
 *
 * Este ficheiro só continua a existir para o caminho `@/lib/csv` seguir válido.
 */
export { detectSeparator, parseCsv, type CsvSeparator } from '@studio/core'
