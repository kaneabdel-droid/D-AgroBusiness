import Link from 'next/link'
import { AuthForm } from '@/components/AuthForm'
import { Card } from '@/components/ui/card'
import { creerT, estRtl } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { langueNavigateur } from '@/lib/i18n-server'

export default async function SignupPage() {
  const lang = await langueNavigateur()
  const t = creerT(lang)
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10" dir={estRtl(lang) ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md">
        <LanguageSwitcher lang={lang} className="mb-4 flex-wrap" />
        <h1 className="font-heading text-2xl font-semibold">{t('Créer votre organisation')}</h1>
        <p className="mb-6 mt-1 text-sm text-foreground-muted">
          {t('Plan comptable, départements et journaux sont préparés automatiquement selon votre pays.')}
        </p>
        <AuthForm mode="signup" lang={lang} />
        <p className="mt-6 text-center text-sm text-foreground-muted">
          {t('Déjà inscrit ?')}{' '}
          <Link href="/login" className="font-medium text-primary underline">
            {t('Se connecter')}
          </Link>
        </p>
      </Card>
    </main>
  )
}
