import Link from 'next/link'
import { AuthForm } from '@/components/AuthForm'
import { Card } from '@/components/ui/card'

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="font-heading text-2xl font-semibold">Créer votre organisation</h1>
        <p className="mb-6 mt-1 text-sm text-foreground-muted">
          Plan comptable, départements et journaux sont préparés automatiquement selon votre pays.
        </p>
        <AuthForm mode="signup" />
        <p className="mt-6 text-center text-sm text-foreground-muted">
          Déjà inscrit ?{' '}
          <Link href="/login" className="font-medium text-primary underline">
            Se connecter
          </Link>
        </p>
      </Card>
    </main>
  )
}
