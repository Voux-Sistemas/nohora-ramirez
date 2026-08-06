import { PhoneForm } from '@/components/auth/phone-form'

export const metadata = { title: 'Entrar' }

export default function ContaEntrarPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Minha conta</h1>
      <p className="text-muted mt-1 mb-6 text-sm">
        Digite seu telefone e mandamos um código para entrar.
      </p>
      <div className="surface rounded-card p-5">
        <PhoneForm />
      </div>
    </div>
  )
}
