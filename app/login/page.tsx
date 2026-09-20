import Link from 'next/link'
import { AuthForm } from '@/components/AuthForm'
import { Card } from '@/components/ui/card'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const { erreur } = await searchParams
  const lang = await langueNavigateur()
  const t = creerT(lang)
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="font-heading text-2xl font-semibold">D-AGROBUSINESS</h1>
        <p className="mb-6 mt-1 text-sm text-foreground-muted">{t('Connexion à votre espace')}</p>
        {erreur === 'organisation' && (
          <p className="mb-4 rounded-lg bg-warning/10 p-3 text-sm">
            {t('Ce compte n’est rattaché à aucune organisation active. Contactez votre administrateur.')}
          </p>
        )}
        <AuthForm mode="login" lang={lang} />
        <p className="mt-6 text-center text-sm text-foreground-muted">
          {t('Pas encore de compte ?')}{' '}
          <Link href="/signup" className="font-medium text-primary underline">
            {t('Créer une organisation')}
          </Link>
        </p>
      </Card>
    </main>
  )
}
