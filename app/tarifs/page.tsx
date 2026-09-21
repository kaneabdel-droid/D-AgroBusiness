import Link from 'next/link'
import type { Metadata } from 'next'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { CartesTarifs, EnTete, PagePublique, Pied, TableauDurees } from '@/components/vitrine/Vitrine'

export async function generateMetadata(): Promise<Metadata> {
  const t = creerT(await langueNavigateur())
  return { title: `${t('Tarifs')} — D-AGROBUSINESS` }
}

const QUESTIONS = [
  ['Comment fonctionne l’essai gratuit ?', 'Chaque entreprise démarre avec 7 jours d’accès complet (niveau Premium), sans carte bancaire. À la fin, l’accès se poursuit avec l’abonnement de votre choix.'],
  ['Comment payer ?', 'Depuis la page Abonnement de l’application, par Mobile Money ou carte bancaire. L’abonnement est activé dès la confirmation du paiement.'],
  ['Puis-je changer de niveau ?', 'Oui, à l’échéance de votre abonnement en cours. Un paiement prolonge toujours l’abonnement à partir de son échéance.'],
  ['Que se passe-t-il si je n’ai pas accès aux RH ou à l’usine ?', 'Ces modules sont masqués et protégés. Vos autres données restent intactes et disponibles dès que vous passez au niveau correspondant.'],
]

export default async function TarifsPage() {
  const lang = await langueNavigateur()
  const t = creerT(lang)

  return (
    <PagePublique lang={lang}>
      <EnTete lang={lang} actif="tarifs" />
      <main>
        <section className="border-b border-surface-border bg-gradient-to-br from-eau-clair via-surface to-[#E6F4DC]">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 md:py-20">
            <h1 className="font-heading text-4xl font-bold md:text-5xl">{t('Un abonnement simple, sans engagement')}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-foreground-muted">{t('Payez au mois ou plusieurs mois d’un coup : 1 % de remise par mois payé, à partir de 2 mois.')}</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <CartesTarifs lang={lang} />
          <h2 className="mb-4 mt-14 font-heading text-2xl font-bold">{t('Prix selon la durée')}</h2>
          <TableauDurees lang={lang} />
          <p className="mt-3 text-sm text-foreground-muted">{t('Montants en francs CFA. Un mois seul est au prix plein.')}</p>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <h2 className="mb-6 font-heading text-2xl font-bold">{t('Questions fréquentes')}</h2>
          <div className="space-y-4">
            {QUESTIONS.map(([q, r]) => (
              <details key={q} className="rounded-xl border border-surface-border bg-surface p-4">
                <summary className="cursor-pointer font-medium">{t(q)}</summary>
                <p className="mt-2 text-sm text-foreground-muted">{t(r)}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover">{t('Créer mon compte')}</Link>
            <Link href="/decouvrir-dagrobusiness" className="rounded-md border border-primary/40 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground">{t('Explorer la démonstration')}</Link>
          </div>
        </section>
      </main>
      <Pied lang={lang} />
    </PagePublique>
  )
}
