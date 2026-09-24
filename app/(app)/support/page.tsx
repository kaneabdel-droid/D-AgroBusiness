import { Phone } from 'lucide-react'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { PageHeader, Card } from '@/components/ui/card'

export default async function SupportPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)

  return (
    <>
      <PageHeader titre={t('Assistance')} description={t('Une question, un problème ? Contactez-nous directement.')} />

      <Card className="flex max-w-2xl items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t('Téléphone')}</p>
          <p className="mt-1 text-sm text-foreground-muted">{t('Du lundi au vendredi, 9h - 18h')}</p>
          <p className="mt-2 font-medium text-foreground" dir="ltr">
            <a href="tel:+221708484298" className="transition-colors hover:text-primary">
              +221 70 848 42 98
            </a>
          </p>
          <a
            href="tel:+221708484298"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            {t('Appeler')}
          </a>
        </div>
      </Card>
    </>
  )
}
