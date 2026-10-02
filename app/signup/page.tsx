import Link from 'next/link'
import { AuthForm } from '@/components/AuthForm'
import { Card } from '@/components/ui/card'
import { creerT, estRtl } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { langueNavigateur } from '@/lib/i18n-server'
import { NIVEAUX, type Niveau } from '@/lib/abonnement'
import { suitePaiement } from '@/lib/suite'

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ niveau?: string }> }) {
  const { niveau } = await searchParams
  const lang = await langueNavigateur()
  const t = creerT(lang)
  // Venue d'une carte de tarifs : après l'inscription, la page de paiement de ce niveau s'ouvre.
  const suite = suitePaiement(niveau)
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10" dir={estRtl(lang) ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md">
        <LanguageSwitcher lang={lang} className="mb-4 flex-wrap" />
        <h1 className="font-heading text-2xl font-semibold">{t('Créer votre organisation')}</h1>
        <p className="mb-6 mt-1 text-sm text-foreground-muted">
          {t('Plan comptable, départements et journaux sont préparés automatiquement selon votre pays.')}
        </p>
        {suite && (
          <p className="mb-4 rounded-lg border border-surface-border bg-sidebar p-3 text-sm">
            {t('Niveau choisi : {niveau}. Le paiement s’ouvrira juste après la création du compte.', { niveau: t(NIVEAUX[niveau as Niveau].nom) })}
          </p>
        )}
        <AuthForm mode="signup" lang={lang} suite={suite} />
        <p className="mt-6 text-center text-sm text-foreground-muted">
          {t('Déjà inscrit ?')}{' '}
          <Link href={suite ? `/login?suite=${encodeURIComponent(suite)}` : '/login'} className="font-medium text-primary underline">
            {t('Se connecter')}
          </Link>
        </p>
      </Card>
    </main>
  )
}
