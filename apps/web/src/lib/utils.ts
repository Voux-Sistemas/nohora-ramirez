import { clsx, type ClassValue } from 'clsx'
import type { Route } from 'next'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Rota montada em tempo de execução.
 *
 * O `typedRoutes` valida caminho literal, e boa parte da navegação daqui é
 * caminho + querystring montados na hora (`?d=…&sel=…`). Este ponto único é
 * onde a garantia é abandonada de propósito — se aparecer em outro lugar, é
 * sinal de que alguém escapou de uma rota que dava para tipar.
 */
export function href(path: string): Route {
  return path as Route
}
