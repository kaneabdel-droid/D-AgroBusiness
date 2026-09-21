import { ShieldCheck } from 'lucide-react'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { connecterAdmin } from './actions'

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams
  const lang = await langueNavigateur()
  const t = creerT(lang)
  const messages: Record<string, string> = {
    identifiants: 'Identifiant ou mot de passe incorrect.',
    acces: 'Ce compte n’a pas accès à l’administration.',
    verrou: 'Trop de tentatives échouées. Patientez 1 minute avant de réessayer.',
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-surface px-4 py-12 sm:px-6">
      <div className="absolute end-4 top-4"><LanguageSwitcher lang={lang} /></div>
      <div className="mx-auto w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><ShieldCheck className="h-6 w-6 text-primary" aria-hidden /></div>
        <h1 className="font-heading text-2xl font-bold">{t('Administration de la plateforme')}</h1>
        <p className="mt-2 text-sm text-foreground-muted">{t('Espace réservé aux administrateurs de D-AGROBUSINESS.')}</p>
      </div>
      <div className="mx-auto mt-8 w-full max-w-sm">
        {erreur && messages[erreur] && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-center text-sm font-medium text-danger">{t(messages[erreur])}</p>
        )}
        <form action={connecterAdmin} className="space-y-4 rounded-2xl border border-surface-border bg-background p-6 shadow-sm">
          <div className="space-y-1.5"><Label htmlFor="email">{t('Email')}</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="space-y-1.5"><Label htmlFor="password">{t('Mot de passe')}</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          <Button type="submit" className="w-full">{t('Se connecter')}</Button>
        </form>
        <p className="mt-6 text-center text-xs text-foreground-muted">
          {t('Vous n’êtes pas administrateur ?')} <a href="/login" className="font-semibold text-primary underline">{t('Connexion à votre entreprise')}</a>
        </p>
      </div>
    </div>
  )
}
