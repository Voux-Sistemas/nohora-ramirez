'use server'

import { redirect } from 'next/navigation'
import { destroySession } from './session'

export async function sair(): Promise<void> {
  await destroySession()
  redirect('/')
}
