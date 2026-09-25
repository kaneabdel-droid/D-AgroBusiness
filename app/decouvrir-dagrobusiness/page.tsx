import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, Calculator, Users, Crown, Wheat, Factory, ShieldCheck, Wallet, LineChart, Landmark } from 'lucide-react'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { EnTete, PagePublique, Pied, carteSurvol } from '@/components/vitrine/Vitrine'
import { connexionDemo } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  const t = creerT(await langueNavigateur())
  return { title: `${t('Découvrir')} D-AGROBUSINESS — ${t('Comment ça marche')}` }
}

const PROFILS = [
  { role: 'direction', icone: Crown, titre: 'Direction', desc: 'Vision d’ensemble : états financiers, budgets, trésorerie prévisionnelle et journal d’audit.' },
  { role: 'comptable', icone: Calculator, titre: 'Comptable', desc: 'Écritures, achats, ventes, trésorerie, rapprochement bancaire, production et usine.' },
  { role: 'rh', icone: Users, titre: 'Ressources humaines', desc: 'Personnel, pointage, congés et bulletins de paie.' },
]

const A_EXPLORER = [
  { icone: Wheat, titre: 'Production agricole', desc: 'Une campagne de riz avec ses intrants, sa récolte et son coût de revient.' },
  { icone: Factory, titre: 'Usine de transformation', desc: 'Du paddy au riz blanc et aux brisures, avec les rendements réels.' },
  { icone: ShieldCheck, titre: 'Traçabilité et qualité', desc: 'Des lots, des contrôles d’humidité et un lot bloqué pour non-conformité.' },
  { icone: Landmark, titre: 'Financement et matériel', desc: 'Un emprunt d’investissement de 24 M F CFA avec son échéancier et ses remboursements.' },
  { icone: Wallet, titre: 'Trésorerie', desc: 'Comptes, règlements, rapprochement bancaire et plan sur 12 mois.' },
  { icone: LineChart, titre: 'Pilotage', desc: 'Bilan, compte de résultat, ratios et suivi de la trésorerie de l’exercice en cours.' },
]

export default async function DecouvrirPage({ searchParams }: { searchParams?: Promise<{ demo_error?: string }> }) {
  const erreur = (await searchParams)?.demo_error === '1'
  const lang = await langueNavigateur()
  const t = creerT(lang)

  return (
    <PagePublique lang={lang}>
      <EnTete lang={lang} actif="decouvrir" />
      <main>
        <section className="relative isolate overflow-hidden border-b border-surface-border">
          {/* Photo réelle (champs cultivés vus du ciel, libre de droits, sans marque ni logo) */}
          <div className="absolute inset-0 -z-20 bg-cover bg-center rtl:-scale-x-100" style={{ backgroundImage: "url('/hero-agro-champs.jpg')" }} aria-hidden />
          <div className="absolute inset-0 -z-10 bg-[#053B5C]/70" aria-hidden />
          <div className="mx-auto max-w-4xl px-4 py-16 text-center text-white sm:px-6 md:py-24">
            <Link href="/bienvenue" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden /> {t('Retour à l’accueil')}
            </Link>
            <h1 className="font-heading text-4xl font-bold md:text-5xl">{t('Découvrez')} <span className="text-[#B7EA8F]">D-AGROBUSINESS</span> {t('en direct')}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/90">{t('Connectez-vous en un clic à une entreprise rizicole de démonstration, avec de vraies données : campagne, usine, paie, trésorerie.')}</p>
          </div>
        </section>

        <section className="border-b border-surface-border bg-eau-clair/60 py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="text-center font-heading text-2xl font-bold md:text-3xl">{t('Choisissez un point de vue')}</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-foreground-muted">{t('Aucun mot de passe : chaque bouton ouvre votre propre session sur l’entreprise « Riz du Delta ». Les données de démonstration sont partagées : n’y saisissez aucune information réelle.')}</p>
            {erreur && <p role="alert" className="mx-auto mt-6 max-w-md rounded-md bg-danger/10 p-3 text-center text-sm text-danger">{t('La démonstration est momentanément indisponible. Réessayez dans un instant.')}</p>}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {PROFILS.map(({ role, icone: Icon, titre, desc }) => (
                <form key={role} action={connexionDemo} className={`flex flex-col rounded-xl border border-surface-border bg-surface p-6 text-center ${carteSurvol}`}>
                  <input type="hidden" name="role" value={role} />
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-eau-clair text-primary"><Icon className="h-6 w-6" aria-hidden /></span>
                  <h3 className="mt-4 font-heading text-lg font-semibold">{t(titre)}</h3>
                  <p className="mt-2 flex-1 text-sm text-foreground-muted">{t(desc)}</p>
                  <button type="submit" className="mt-5 inline-flex items-center justify-center gap-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover">
                    {t('Entrer dans la démo')} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                  </button>
                </form>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">{t('Ce que vous pourrez explorer')}</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {A_EXPLORER.map(({ icone: Icon, titre, desc }) => (
              <div key={titre} className={`rounded-xl border border-surface-border bg-surface p-6 ${carteSurvol}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-eau-clair text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="mt-4 font-heading text-lg font-semibold">{t(titre)}</h3>
                <p className="mt-2 text-sm text-foreground-muted">{t(desc)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#0A3A55] py-14 text-center text-white">
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="font-heading text-2xl font-bold md:text-3xl">{t('Convaincu ? Lancez votre propre entreprise.')}</h2>
            <p className="mt-3 text-[#A8C9D8]">{t('7 jours d’essai gratuit, sans carte bancaire.')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/tarifs" className="rounded-md bg-vert px-6 py-3 text-sm font-semibold text-white transition hover:bg-vert-fonce">{t('S’abonner')}</Link>
              <Link href="/signup" className="rounded-md border border-white/60 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-primary">{t('Créer mon compte')}</Link>
            </div>
          </div>
        </section>
      </main>
      <Pied lang={lang} />
    </PagePublique>
  )
}
