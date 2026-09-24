import { Mail, Phone } from 'lucide-react'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { PageHeader, Card } from '@/components/ui/card'
import { ContactForm } from './ContactForm'

export default async function SupportPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)

  return (
    <>
      <PageHeader titre={t('Assistance')} description={t('Une question, un problème ? Contactez-nous directement.')} />

      <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card className="flex items-start gap-4">
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

          <Card className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t('Email')}</p>
              <p className="mt-1 text-sm text-foreground-muted">{t('Réponse par email sous 24 h ouvrées')}</p>
              <p className="mt-2 whitespace-nowrap text-sm font-medium text-foreground" dir="ltr">
                <a href="mailto:support@dembasolution.com" className="transition-colors hover:text-primary">
                  support@dembasolution.com
                </a>
              </p>
            </div>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('Envoyez-nous un message')}</h2>
          <p className="mb-6 text-sm text-foreground-muted">
            {t('Un bug, une question ? Décrivez votre demande : nous vous répondons directement par email.')}
          </p>
          <ContactForm />
        </Card>
      </div>
    </>
  )
}
